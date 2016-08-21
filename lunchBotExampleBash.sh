#!/usr/bin/env bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/games:/usr/games
lunchbotDir=~/www/lunchBot
outputFile=$lunchbotDir/lunchBot.log
cd $lunchbotDir
echo "RUNNING" >> $outputFile
token=YOUR-SLACKBOT-TOKEN node lunchBot.js >> $outputFile
