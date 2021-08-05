const { ChatClient } = require("dank-twitch-irc");
const Discord = require('discord.js');
const fs = require('fs');
const tools = require("./tools.js")

async function updateConfig() {
    const data = JSON.stringify(config);
    fs.writeFile('./config.json', data, 'utf8', (err) => {
        if (err) {
            console.log(`Error writing file: ${err}`);
        } else {
            console.log(`Config updated successfully!`);
        }
    });
}

try {
    const data = fs.readFileSync('./config.json', 'utf8');
    var config = JSON.parse(data);
} catch (err) {
    console.log(`Error reading file from disk: ${err}`);
}

if (!config.username || !config.oauth || !config.bot_token) {
    console.log("Please check your config!");
    process.exitCode = 2;
}

var tclient = new ChatClient({ username: config["username"], password: config["oauth"] }); // Init Twitch

const dclient = new Discord.Client(); //Init discord

dclient.on('ready', async => {
    console.log(`Logged into discord as ${dclient.user.tag}!`); // Discord on ready
    tclient.connect(); //Init connection to twitch after discord is ready
    console.log(`Connecting to channels ${Object.keys(config.channels)}`);
    tclient.joinAll(Object.keys(config.channels)); //Join all defined channels
}); 

tclient.on("ready", async => console.log(`Logged into twitch as ${config.username}`)); // Twitch on ready

tclient.on("close", (error) => {
    if (error != null) {
        console.error("Client closed due to error", error);
    }
});

async function logToDiscord(channelName, msg, type) {
    if (tools.isInArray(type, config["channels"][channelName]["blacklisted_usernotices"])) {
        return;
    }
    console.log(`[Twitch] ${msg}`)
    let channel = dclient.channels.cache.get(config["channels"][channelName]["discord_channel_id"]);
    await channel.send(msg, MessageOptions = { allowedMentions: { parse: null } })
  }

dclient.on('message', async message => { //Handle messages from discord to twitch
    var channel = null;
    for (const [key, value] of Object.entries(config.channels)) { // Search through dict of channels to check if channel is an IRC enabled channel
        if (message.channel.id === value.discord_channel_id) {
            channel = key;
        }
    }
    if (channel === null) { //If a channel wasn't found, ignore
        return;
    }

    if (tools.isInArray(message.author.id, config["channels"][channel]["allowed_discord_user_ids"])) { //Check if user is allowed to be forwarded to twitch
        for (var i=0; i < config["prefix_exclusions"].length; i++) {
            if (message.content.startsWith(config["prefix_exclusions"][i])) {
                return;
            }
        }
        var re = new RegExp('<(a?):([a-zA-Z0-9_]{2,32}):([0-9]{18,22})>', "g"); //Regex for discord emotes. Found on discord.py discord
        var arr = message.cleanContent.matchAll(re);
        var s = message.cleanContent;

        for (const match of arr) {
            s = s.replace(match[0], match[2]);
        }
        console.log(`[Discord] #${channel} ${message.author.tag}: ${s}`); //Log to console
        await tclient.privmsg(channelName = channel, message = s); //Send the message to the IRC
    }
});

tclient.on("PRIVMSG", async message => { //Handle normal messages from twitch to discord
    if (message.isCheer()) { //Cheers aren't really usernotices, but we're gonna treat them like they are
        if (config["channels"][message.channelName]["forward_usernotices"]) {
            let content = `#${message.channelName} [Notification] ${message.displayName} cheered ${message.bits} bits! [${message.messageText}]`;
            logToDiscord(message.channelName, content, type = "bits");
        }
    }
    if (tools.isInArray(message.senderUsername, config["channels"][message.channelName]["forwarded_twitch_users"])) {
        let channel = dclient.channels.cache.get(config["channels"][message.channelName]["discord_channel_id"]);
        if (channel == null) {
            console.log(`Discord channel for ${message.channelName} returned None`);
            return;
        }
        console.log(`[Twitch] #${message.channelName} ${message.senderUsername}: ${message.messageText}`); //Log to console
        await channel.send(`#${message.channelName} [Message] ${message.displayName}: ${message.messageText}`, MessageOptions = { allowedMentions: { parse: null } });
    }
});

tclient.on("CLEARCHAT", async message => {
    if (!config["channels"][message.channelName]["forward_usernotices"]) {
        return;
    }
    if (!config["channels"][message.channelName]["forward_user_channel_usernotices"]) {
        return;
    }
    if (message.isTimeout()) {
        let content = `#${message.channelName} [Notification] ${message.targetUsername} was timed out for ${message.banDuration} seconds`
        logToDiscord(message.channelName, content, type = "timeout");
      }
    else if (message.wasChatCleared()) {
        let content = `#${message.channelName} [Notification] Chat was cleared by a moderator`
        logToDiscord(message.channelName, content, type = "chatclear");
      }
    else if (message.isPermaban()) {
        let content = `#${message.channelName} [Notification] ${message.targetUsername} was banned`
        logToDiscord(message.channelName, content, type = "ban");
      }
});

tclient.on("CLEARMSG", async message => {
    let content = `#${message.channelName} [Notification] ${message.targetUsername} had a message deleted (${message.targetMessageContent})`
    logToDiscord(message.channelName, content, type = "delete");
});

tclient.on("USERNOTICE", async message => { // Everything to do with usernotices
    if (!config["channels"][message.channelName]["forward_usernotices"]) {
        return;
    }
    if (message.isSub() || message.isResub()) {
        //Sub notifications
        let subPlan = "";
        if (!isNaN(message.eventParams.subPlan)) {
            subPlan = `at Tier ${Number(message.eventParams.subPlan) / 1000}`
        }
        else {
            subPlan = `with ${message.eventParams.subPlan}`
        }
        if (message.isSub()) {
            let content = `#${message.channelName} [Notification] ${message.displayName} subscribed ${subPlan}.`;
            logToDiscord(message.channelName, content, type = "sub");
        }
        else if (message.isResub()) {
            let streakMessage = "";
            if (message.eventParams.shouldShareStreak) {
                streakMessage = `, currently on a ${message.eventParams.streakMonths} month streak`;
            }
            let resubMessage = "";
            if (message.messageText != null) {
                resubMessage = ` [${message.messageText}]`;
            }
            let content = `#${message.channelName} [Notification] ${message.displayName} subscribed ${subPlan}. They've subscribed for ${message.eventParams.cumulativeMonths} months${streakMessage}!${resubMessage}`;
            logToDiscord(message.channelName, content, type = "resub");
        }
    }

    else if (message.isRaid()) {
        let content = `#${message.channelName} [Notification] ${message.eventParams.viewercount} raiders from ${message.displayName} have joined!`;
        logToDiscord(message.channelName, content, type = "raid");
    }

    else if (message.isSubgift() || message.isAnonSubgift()) {
        let gifter = "";
        if (message.isAnonSubgift()) {
            gifter = "AnAnonymousGifter";
        }
        else {
            gifter = message.displayName;
        }
        let giftMultipleMonth = "";
        if (message.eventParams.giftMonths > 1) {
            giftMultipleMonth = ` It's a ${message.eventParams.giftMonths}-month gift!`;
        }
        let subPlan = "";
        if (!isNaN(message.eventParams.subPlan)) {
            subPlan = Number(message.eventParams.subPlan) / 1000;
        }
        //Sub gift notifications
        if (message.eventParams.months === 1) {
            let content = `#${message.channelName} [Notification] ${gifter} gifted a Tier ${subPlan} sub to ${message.eventParams.recipientDisplayName}!${giftMultipleMonth}`;
            logToDiscord(message.channelName, content, type = "subgift");
        }
        else {
            let content = `#${message.channelName} [Notification] ${gifter} gifted a Tier ${subPlan} sub to ${message.eventParams.recipientDisplayName}!${giftMultipleMonth} ${message.eventParams.recipientDisplayName} has subscribed for ${message.eventParams.months} months!`;
            logToDiscord(message.channelName, content, type = "subgift");
        }
    }

    else if (message.isAnonGiftPaidUpgrade() || message.isGiftPaidUpgrade()) {
        let gifter = "";
        if (message.isAnonGiftPaidUpgrade()) {
            giter = "AnAnonymousGifter";
        }
        else {
            gifter = message.eventParams.senderName;
        }
        let content = `#${message.channelName} [Notification] ${message.displayName} is continuing the Gift Sub they got from ${gifter}!`;
        logToDiscord(message.channelName, content, tpye = "giftcontinue");
    }

    else if (message.isBitsBadgeTier()) {
        let content = `#${message.channelName} [Notification] ${message.displayName} unlocked the ${message.eventParams.threshold} bit badge!`;
        logToDiscord(message.channelName, content, "bitstier");
    }
});

tclient.on("message", async message => {//Hosts and other usernotices need to be logged in other ways. :)
    if (message.ircCommand === "NOTICE") {
        var type = message.messageID;
        let documented_usernotices = ["bits", "sub", "resub", "raid", "subgift", "giftcontinue", "bitstier"]; //Be sure to ignore usernotices that are already handled above
        if (tools.isInArray(type, documented_usernotices)) {
            return;
        }
        fs.appendFile('./IDlogs.log', `[${message.channelName}] ${message.messageID}: ${message.messageText}\n`, 'utf8', (err) => {
            if (err) {
                console.log(`Error writing ID log file: ${err}`);
            }
        });

        let personal_usernotices = ["host", "host_on", "hostoff", "mod_success", "unmod_success", "vip_success", "unvip_success", "timeout_success", "untimeout_success", "ban_success", "unban_success", "cmds_available", "room_mods", "room_vips"]; //The generally used ones that are directed at the user
        if (!tools.isInArray(type, personal_usernotices)) {
            type = "other"; //If it's not in this general list of usernotice types, just set it to other. Most usernotices won't come in here
        }
        if (!config["channels"][message.channelName]["ignore_personal_usernotices"]) { //This is for ignoring notices only for the specific user, or hosts/raids.
            logToDiscord(message.channelName, `[Notification]: ${message.messageText}`, type); //For example when you vip/ban/mod a user, or when the channel hosts or exists hosting mode
        }
    }
});


//Establish discord connection
dclient.login(config["bot_token"]); //Login to discord
