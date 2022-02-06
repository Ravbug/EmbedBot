// NOT Part of the main bot codebase
// run independently to notify Discord of the bot's commands

const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
let envdata;
if (process.env.TOKEN == undefined){
    envdata = require("./env.json");
}
else{
   envdata = process.env;
}

const registrationData = {
    clientId: envdata["CLIENT_ID"],
    devServerId: envdata["DEV_SERVER"],
    token: envdata["TOKEN"]
}

console.log(`Registering commands for app with id ${registrationData.clientId}`)

const commands = [
	new SlashCommandBuilder().setName('reddit').setDescription('Embed a reddit post')
        .addStringOption(option=> option.setName("redditurl").setDescription("URL to Reddit content").setRequired(true)),
    new SlashCommandBuilder().setName('embed').setDescription('Embed a website - use if a specific command is not available')
        .addStringOption(option=> option.setName("url").setDescription("URL to web content").setRequired(true))
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(registrationData.token);

rest.put(Routes.applicationGuildCommands(registrationData.clientId, registrationData.devServerId), { body: commands })
.then(() => console.log('Successfully registered application development commands.'))
.catch(console.error);

if(process.env.TOKEN != undefined)
{
    rest.put(Routes.applicationCommands(registrationData.clientId), { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);
}