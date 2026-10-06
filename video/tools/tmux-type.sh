#!/bin/zsh
# tmux-type.sh <session> <command…>: types a command like a person, presses Enter, waits for the prompt.
s=$1; shift; cmd="$*"
for ((i=1; i<=${#cmd}; i++)); do tmux send-keys -t $s -l -- "${cmd[i]}"; sleep 0.0$((RANDOM % 5 + 3)); done
sleep 0.6; tmux send-keys -t $s Enter; sleep 1
for i in $(seq 1 300); do tmux capture-pane -p -t $s | grep -v '^\s*$' | tail -1 | grep -qE '\$ *$' && break; sleep 1; done
sleep ${HOLD:-2}
