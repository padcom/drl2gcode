#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { parse as parseFileName, format as formatFileName } from 'node:path'
import { program } from 'commander'
import { existsSync } from 'node:fs'

import pkg from './package.json' with { type: 'json' }

function parseDrl(content) {
  const RX_TOOL_DEFINITION = /^(?<tool>T\d+)C(?<diameter>[\d\.]+)$/
  const RX_TOOL_SELECTOR = /^(?<tool>T\d+)$/
  const RX_ITEM = /^X(?<x>[-\d\.]+)Y(?<y>[-\d\.]+)$/

  let state = 0
  const result = {
    units: 'METRIC',
    batches: []
  }

  let current = null

  for (const data of content) {
    const line = data.trim()
    if (!line) continue
    if (line.trim().startsWith(';')) continue

    if (line === 'METRIC') result.units = 'METRIC'
    const toolDefinition = RX_TOOL_DEFINITION.exec(line)
    if (toolDefinition) {
      result.batches.push({
        id: toolDefinition.groups.tool,
        diameter: toolDefinition.groups.diameter,
        items: []
      })
    }

    const toolSelector = RX_TOOL_SELECTOR.exec(line)
    if (toolSelector) {
      current = result.batches.find(batch => batch.id === toolSelector.groups.tool)
    }

    const item = RX_ITEM.exec(line)
    if (item && current) {
      current.items.push({ x: item.groups.x, y: item.groups.y })
    }
  }

  return result
}

function drlToGCode(batch, { units, feedrate, spindle, jogZ, moveZ, depth }) {
  const gcode = []
  gcode.push('; Generated using drl2gcode by Matthias Hryniszak')
  gcode.push('G17     ; choose XpYp plane')
  gcode.push('G90     ; absolute positioning')
  if (units === 'METRIC') gcode.push('G21     ; metric units')
  else gcode.push('G20     ; imperial units')
  gcode.push(`G1 F${feedrate}  ; set feed rate to 10mm/min`)
  gcode.push(`M03S${spindle} ; Start spindle clock-wise at ${spindle} RPM`)
  gcode.push(`G0Z${jogZ}`)
  batch.items.forEach(item => {
    gcode.push(`G0X${item.x}Y${item.y}`)
    gcode.push(`G1Z-${depth}`)
    gcode.push(`G0Z${moveZ}`)
  })
  gcode.push(`G0Z${jogZ}   ; raise Z axis`)
  gcode.push('M05     ; stop spindle')
  gcode.push('G0X0Y0  ; move to start position')
  gcode.push('M02     ; end program')

  return gcode.join('\n')
}

async function convert(drlFileName, { quiet, feedrate, spindle, jogZ, moveZ, depth }) {
  if (!drlFileName) {
    console.error('ERROR: no input file specified')
    process.exit(1)
  } else if (!existsSync(drlFileName)) {
    console.error('ERROR: specified input file does not exist')
    process.exit(2)
  } else {
    if (!quiet) process.stdout.write('Reading ' + drlFileName + '... ')
    const content = await readFile(drlFileName)

    if (!quiet) process.stdout.write('Parsing... ')
    const drl = parseDrl(content.toString().split('\n'))
    if (!quiet) process.stdout.write('done\n')

    for (const batch of drl.batches) {
      const parts = parseFileName(drlFileName)
      const outputFileName = formatFileName({ parts, name: parts.name + '-' + batch.id, ext: 'nc' })
      if (!quiet) process.stdout.write('Generating GCode for ' + batch.id + ' with diameter ' + batch.diameter + '... ')
      const gcode = drlToGCode(batch, { units: drl.units, feedrate, spindle, jogZ, moveZ, depth })
      if (!quiet) process.stdout.write('Writing ' + outputFileName + '... ')
      await writeFile(outputFileName, gcode)
      if (!quiet) process.stdout.write('done\n')
    }
  }
}

program
  .name(pkg.name)
  .version(pkg.version)

program
  .description('Converts DRL file to GCode')
  .argument('<input>', 'Input DRL file (required)')
  .option('-q, --quiet', 'Be quiet')
  .option('-f, --feedrate <rate>', 'Feed rate for drilling', 50)
  .option('-s, --spindle <speed>', 'Spindle speed', 400)
  .option('-j, --jog-z <z-height>', 'Z height for initial and final jogging', 15)
  .option('-m, --move-z <z-height>', 'Z height for jogging between points', 1)
  .option('-d, --depth <depth>', 'Drilling depth', 2.5)
  .action(convert)
  .parse(process.argv)
