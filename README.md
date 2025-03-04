# Quick and dirty .drl to gcode converter

```
Usage: npx drl2gcode@latest [options] <input>

Converts DRL file to GCode

Arguments:
  input                    Input DRL file (required)

Options:
  -V, --version            output the version number
  -q, --quiet              Be quiet
  -f, --feedrate <rate>    Feed rate for drilling (default: 50)
  -s, --spindle <speed>    Spindle speed (default: 400)
  -j, --jog-z <z-height>   Z height for initial and final jogging (default: 15)
  -m, --move-z <z-height>  Z height for jogging between points (default: 1)
  -d, --depth <depth>      Drilling depth (default: 2.5)
  -h, --help               display help for command
```
