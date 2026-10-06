#!/bin/zsh
# render-cast.sh <in.cast> <out.mp4>: asciicast → mp4 in the video's terminal look
set -e
d=${0:A:h}/..
agg --font-dir $d/rec/fonts --font-family "Atkinson Hyperlegible Mono,Menlo" --font-size 30 --line-height 1.3 --idle-time-limit ${IDLE:-2.5} --fps-cap 30 --last-frame-duration 4 \
  --theme 1f1d1a,ece8de,1f1d1a,e26a5a,7fbf8a,e2b33f,6fa8dc,c58bd4,7fc4c9,ece8de,67635a,ff8a7a,9fdcaa,f2cd6a,8fc0ec,d9a6e6,9fe0e4,ffffff \
  $1 $1.gif >/dev/null 2>&1
ffmpeg -v error -y -i $1.gif -vf "fps=30,pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p" -c:v libx264 -crf 14 $2
rm $1.gif
ffprobe -v error -show_entries format=duration -of csv=p=0 $2
