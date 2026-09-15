#!/usr/bin/env bash
# Post-process a nav-bar.webm from scripts/record/nav-bar.mjs into the
# demo MP4s. Usage: scripts/record/post-nav-bar.sh <nav-bar.webm> <outDir> [cropTop]
#   full.mp4       — the take, real time
#   full-1.25x.mp4 — uniform 1.25× speed-up
#   bar-1.25x.mp4  — 1.25× cropped from cropTop (default 452 — for a
#                    RAISE=88 take; sheets top out ~60px below that) to the
#                    bottom, with the full-screen Scan beat cut out. The
#                    beat is found by blackdetect rather than a timestamp:
#                    takes drift by up to a couple of seconds run to run.
set -euo pipefail
in=$1; out=$2; top=${3:-452}
mkdir -p "$out"
enc=(-c:v libx264 -pix_fmt yuv420p -crf 17 -movflags +faststart -an)
ffmpeg -v error -y -i "$in" "${enc[@]}" "$out/full.mp4"
ffmpeg -v error -y -i "$out/full.mp4" -vf "setpts=PTS/1.25" -r 30 "${enc[@]}" "$out/full-1.25x.mp4"
ffmpeg -v error -y -i "$out/full-1.25x.mp4" -vf "crop=430:$((900 - top)):0:$top" "${enc[@]}" "$out/_crop.mp4"
read -r bs be < <(ffmpeg -v info -i "$out/_crop.mp4" -vf "blackdetect=d=1:pix_th=0.20:pic_th=0.85" -an -f null - 2>&1 \
  | tr -d '\r' | sed -n 's/.*black_start:\([0-9.]*\) black_end:\([0-9.]*\).*/\1 \2/p' | head -1)
[ -n "${bs:-}" ] || { echo "no scan segment detected" >&2; exit 1; }
cs=$(awk -v s="$bs" 'BEGIN{printf "%.2f", s-1.0}')
ce=$(awk -v e="$be" 'BEGIN{printf "%.2f", e+0.8}')
ffmpeg -v error -y -i "$out/_crop.mp4" -filter_complex \
  "[0:v]trim=0:$cs,setpts=PTS-STARTPTS[a];[0:v]trim=$ce,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]" \
  -map "[v]" "${enc[@]}" "$out/bar-1.25x.mp4"
rm -f "$out/_crop.mp4"
echo "scan cut ${cs}s to ${ce}s; wrote $out/{full,full-1.25x,bar-1.25x}.mp4"
