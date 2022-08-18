const {EmbedBuilder,ButtonBuilder,ActionRowBuilder,SelectMenuBuilder,ModalBuilder,TextInputBuilder,TextInputStyle} = require("discord.js")
const { createAudioPlayer, joinVoiceChannel, createAudioResource } = require('@discordjs/voice');

const fetch = require("node-fetch")

const {Client} = require("discord.js")
const client = new Client({intents:3276799})
const fs = require("fs")

const Commands = []

const dev = process.env.DEV

client.on("ready",async() => {

    console.log(`Hey I am ${client.user.username}!`)

    const loadCommands = async () => {
        
        let files = fs.readdirSync(__dirname + "/Commands/")
        
        files = files.filter(f => f.endsWith(".js"))
        if(files.length <= 0) return
        
        for(const file of files){
        
            let command = require(__dirname + "/Commands/" + file)
            Commands.push(command)
        
        }
            

    }

    await loadCommands()

    client.application.commands.set(Commands)
})

let serversListening = []

client.on("interactionCreate",async (interaction) => {
    
    if(!interaction.isCommand()) return
    await interaction.deferReply()
    const command = Commands.find(c => c.name == interaction.commandName)
    if(!command) return interaction.editReply("Invalid Interaction")
    try{
        await command.callback(interaction,serversListening)
    }catch(err){
        console.log(err)
        return interaction.editReply("An Error Occured")
    }
})

client.on("interactionCreate",async(interaction) => {
    
    if(interaction.isCommand()) return
    if(!interaction.member.voice.channelId) return interaction.reply({content:"You must be in a voice channel to interact with the menu",ephemeral:true})

    if(interaction.isButton()){
        if(interaction.customId === "search"){
            
            let modal = new ModalBuilder()
            .setCustomId("modal-search")
            .setTitle("Search Channels By (Fill only one)")

            let name = new TextInputBuilder()
            .setLabel("Name")
            .setCustomId("name")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("eg paxtan")
            .setRequired(false)
            
            let tag = new TextInputBuilder()
            .setLabel("Tag")
            .setCustomId("tag")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("eg jazz")
            .setRequired(false)
            
            let country = new TextInputBuilder()
            .setLabel("Country")
            .setCustomId("country")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("eg Pakistan")
            .setRequired(false)
            
            let language = new TextInputBuilder()
            .setLabel("Language")
            .setCustomId("language")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("eg urdu")
            .setRequired(false)

            let one = new ActionRowBuilder().addComponents(name)
            let two = new ActionRowBuilder().addComponents(tag)
            let three = new ActionRowBuilder().addComponents(country)
            let four = new ActionRowBuilder().addComponents(language)

            modal.addComponents([one,two,three,four])

            await interaction.showModal(modal)

        }else if(interaction.customId === "next"){
            
            let serverData = serversListening.find(s => s.id === interaction.guild.id)
            if(!serverData || serverData.data?.length < 1) return interaction.update(await generateMenu())
            serverData.currentPage++
            interaction.update(await generateSearchMenu(serverData.data,serverData.currentPage))
        }else if(interaction.customId === "previous"){
            
            let serverData = serversListening.find(s => s.id === interaction.guild.id)
            if(!serverData || serverData.data?.length < 1) return interaction.update(await generateMenu())
            serverData.currentPage--
            interaction.update(await generateSearchMenu(serverData.data,serverData.currentPage))

        }else if(interaction.customId === "home"){
            interaction.update(await generateMenu())
        
        }else if(interaction.customId === "home-player"){
            serversListening.find(s => s.id === interaction.guild.id)?.player?.stop()
            interaction.update(await generateMenu())
        }
    }
    
    if(interaction.isModalSubmit()){
        
        await interaction.deferUpdate()

        let fields = interaction.fields.components.map(f => {
            return {
                name:f.components[0].customId,
                value:f.components[0].value
            }
        }).filter(f => f.value.length > 0)

        if(fields.length > 1) return interaction.editReply({content:"Please Only Fill One Of The Fields",ephemeral:true})
        if(fields.length < 1) return interaction.editReply({content:"Please Fill One Of The Fields",ephemeral:true})

        let rawData

        switch (fields[0].name.toLowerCase()){
            case "name":
                rawData = await fetch(`http://all.api.radio-browser.info/json/stations/byname/${fields[0].value.toLowerCase()}?limit=500`)
                break
            case "country":
                rawData = await fetch(`http://all.api.radio-browser.info/json/stations/bycountry/${fields[0].value.toLowerCase()}?limit=500`)
                break
            case "language":
                rawData = await fetch(`http://all.api.radio-browser.info/json/stations/bylanguage/${fields[0].value.toLowerCase()}?limit=500`)
                break
            case "tag":
                rawData = await fetch(`http://all.api.radio-browser.info/json/stations/bytag/${fields[0].value.toLowerCase()}?limit=500`)
                break
        }

        let data = await rawData.json()

        if(data.length === 0) return interaction.editReply({content:"No Stations Found",ephemeral:true})
        
        data = filterArray(data)

        data = data.map((s,index) => {
            s.name = `**${index + 1}. **` + s.name
            return s
       })

       //Convert array into chunks of 25 elements for pagination
        data = data.reduce((resultArray, item, index) => { 
            const chunkIndex = Math.floor(index/25)
          
            if(!resultArray[chunkIndex]) {
              resultArray[chunkIndex] = [] // start a new chunk
            }
          
            resultArray[chunkIndex].push(item)
          
            return resultArray
          }, [])
        
        if(!serversListening.some(s => s.id === interaction.guild.id)) serversListening.push({id:interaction.guild.id,currentPage:1,data})
        else { 
            serversListening.find(s => s.id === interaction.guild.id).data = data
            serversListening.find(s => s.id === interaction.guild.id).currentPage = 1
        }
        if(serversListening.some(s => s.id === interaction.guild.id)) return interaction.editReply(await generateSearchMenu(serversListening.find(s => s.id === interaction.guild.id).data,serversListening.find(s => s.id === interaction.guild.id).currentPage))
        interaction.editReply(await generateMenu)
    
    }else if(interaction.isSelectMenu()){
        
        let value = interaction.values[0]
        let station = [].concat.apply([], serversListening.find(i => i.id === interaction.guild.id).data).find(s => s.stationuuid === value)
        station.name = station.name.replace(/[*]/g,"")

        if(!interaction.member.voice.channelId) return interaction.reply({content:"Please Join A Voice Channel First",ephemeral:true})

        try{
            
            const player = createAudioPlayer()
            
            const resource = createAudioResource(station.url);

            const connection = joinVoiceChannel({
                channelId: interaction.member.voice.channelId,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            connection.subscribe(player)

            player.play(resource)

            serversListening.find(s => s.id === interaction.guild.id).player = player

        }catch(err){
            console.log(err)
            return interaction.reply({content:"An error occured while attempting to play station. Please check if bot has the permissions to join a voice channel. If error remains, contact the Developer",ephemeral:true})
        }

        interaction.update(await generateStationMenu(station))

    }
})


async function generateSearchMenu(data,currentPage){
        

    let pageData = data[currentPage - 1]

    let pages = data.length

    let embed = new EmbedBuilder()
    .setTitle(`Stations Found!`)
    .setDescription(pageData.map((s,index) => {
        return s.name
    }).join("\n\n"))
    .setColor("#36393F")
    .setFooter({text:`Page ${currentPage}/${pages}`})

    let next = new ButtonBuilder()
    .setLabel("≫")
    .setCustomId("next")
    .setStyle("Danger")
    .setDisabled(currentPage === pages)

    let previous = new ButtonBuilder()
    .setLabel("≪")
    .setCustomId("previous")
    .setStyle("Danger")
    .setDisabled(currentPage <= 1)

    let back = new ButtonBuilder()
    .setLabel("🚪")
    .setCustomId("home")
    .setStyle("Danger")

    let selector = new SelectMenuBuilder()
    .setCustomId('station')
	.setPlaceholder('Select Station To Play') 
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(pageData.map((s,i) => {
        return {
            label:s.name.replace(/[*]/g,""),
            description:`${s.country} | ${s.language}`,
            value:s.stationuuid,
        }
    }))

    let row1 = new ActionRowBuilder()
    .addComponents([previous,next,back])
    
    let row2 = new ActionRowBuilder()
    .addComponents([selector])

    return {embeds:[embed],components:[row1,row2]}
}

function generateMenu(){
    
    let embed = new EmbedBuilder()
    .setTitle("Digital Radio Player")
    .setDescription("Search For Stations | Play Stations | Save Them To Favourites")
    .setColor("#36393F")
    .setImage("https://i.pinimg.com/originals/f0/be/66/f0be6640bddc93b159993525f103fc33.gif")
    .setFooter({text:`Developed By ${dev}`})

    let search = new ButtonBuilder()
    .setLabel("Search")
    .setStyle("Danger")
    .setCustomId("search")

    let favourites = new ButtonBuilder()
    .setLabel("Favourites")
    .setStyle("Danger")
    .setCustomId("Favourites")
    
    let row = new ActionRowBuilder()
    .addComponents([search,favourites])

    return {embeds:[embed],components:[row]}
}

async function generateStationMenu(station){
    
    let embed = new EmbedBuilder()
    .setAuthor({name:station.name,iconURL:(station.favicon === "" ? null :station.favicon) })
    .setDescription(`${station.country} | ${station.language}`)
    .setFooter({text:`Developed By ${dev}`})
    .setColor("#36393F")
    embed.setImage(station.favicon === "" ? "https://i.pinimg.com/originals/f0/be/66/f0be6640bddc93b159993525f103fc33.gif":station.favicon)

    let home = new ButtonBuilder()
    .setLabel("🚪Home")
    .setCustomId("home-player")
    .setStyle("Danger")

    let row = new ActionRowBuilder()
    .addComponents([home]) 

    return {embeds:[embed],components:[row]}
}

function filterArray(array){
    
    let filteredArray = []
    
    for(let i = 0;i<array.length;i++){

        if(!filteredArray.find(f => f.url === array[i].url)) filteredArray.push(array[i])

    }

    return filteredArray
}

client.login(process.env.TOKEN)
