<h1 align="center">LunchBot</h1>
![Hotdawg]
(http://emojipedia-us.s3.amazonaws.com/cache/52/60/5260c85742f897e6a33ec23e965d5445.png)

## The Problem
I'm lucky enough to work for a company that provides lunch for its employees every day. We use a service called [OrderUp](www.orderup.com) that provides delivery services for a large number of restaurants in our area. As you can imagine, trying to figure out where to eat became a chore as our company grew. Even when someone volunteered to make a decision, we often ate from the same 5-10 restaurants. 

## The Solution
LunchBot gives us 5 randomly selected restaurants. It only allows one restaurant per category (e.g., we only get one thai option, not four). It also prevents winners from being options for the rest of the week. For instance, if 'Downtown Thai' wins on Monday, it will not be an option for the remainder of the week.

It runs on a schedule on my raspberry pi in the basement. At 9:30 AM, a cron task starts lunchBot. It counts votes (via reactions), until 10:30 AM, when it announces the winner. 

### Setup
* npm install
* Edit config.json with your list of restaurants, channel ID, and time options.
* If running lunchBot via cron, make sure to copy lunchBotExample.sh and edit it with the proper directories and your slackBot token.

### Running lunchBot

Outside of cron
```
token=SLACKBOT-TOKEN node lunchBot.js
```

Cron
```
# m h  dom mon dow   command
30 9 * * 1-5 /path/to/your/lunchBot.sh
```
