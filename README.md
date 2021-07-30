This is one of my beginner js projects that allows communication to twitch via discord
It supports forwarding various usernotices such as subs, raids, timeouts, along with usernotices that are sent to only the user such as modding/viping etc

This is kinda a weird project that a friend suggested to me. I'm also bad at JS lmao

#Requirements:
Node v12+

# Setup:
1. Clone the repo
2. Run `npm install` inside the cloned directory
3. Rename `exampleconfig.json` to `config.json`
4. Fill in the required information inside the config. All IDs inside the channels key MUST BE STRINGS. (For the discord channel ID and the discord user IDs). The prefix exclusions are an array of characters, where if the sent message from discord starts with an item in this array, the message will not be forwarded. This is useful for having conversations in the same chat, or hiding bot commands.
5. Run the script with `node main.js`

Each key inside the channels is a twitch channel.
* Disabling `forward_usernotices` disables ALL usernotices, only messages from users that are in the `forwarded_twitch_users` will be sent through.
* Disabling `forward_user_channel_usernotices` hides all bans and timeouts that are sent. Keep in mind these don't include who executed the ban or the timeout
* Enabling `ignore_personal_usernotices` prevents responses such as when you vip/mod/timeout a user through this script specifically.
* Blacklisting usernotices prevents specific usernotices from being sent if the option to forward them is enabled. The list of them is shown below.
* Allowed discord IDs are an array of user IDs that are able to send messages and have them be forwarded to twitch. The IDs must be strings.
* The discord channel ID is the channel that the messages will be forwarded to. It also must be a string

Usernotice Blacklist Options: `bits, sub, resub, raid, subgift, giftcontinue, bitstier, host_on, host_off, mod_success, unmod_success, vip_success, unvip_success, timeout_success, untimeout_success, ban_success, unban_success, cmds_available, room_mods, room_vips, timeout, chatclear, ban, delete`
There are far more usernotices, but due to the sheer amount, such as incorrect usage, and errors, they have been categorized into "other".
