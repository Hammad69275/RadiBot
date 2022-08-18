const {EmbedBuilder,ButtonBuilder,ActionRowBuilder,SelectMenuBuilder} = require("discord.js")

module.exports = {
    name:"setup",
    description:"switch on the radio",
    callback:async(interaction,currentServers) => {
        
        if(!interaction.guild) return

        let embed = new EmbedBuilder()
        .setTitle("Digital Radio Player")
        .setDescription("Search For Stations | Play Stations | Save Them To Favourites")
        .setColor("#36393F")
        .setImage("https://i.pinimg.com/originals/f0/be/66/f0be6640bddc93b159993525f103fc33.gif")
        .setFooter({text:`Developed By ${process.env.DEV}`})

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

        let channel = await interaction.guild.channels.create({type:0,name:"Gujjar Radio Network"})
        
        channel.send({embeds:[embed],components:[row]})
        
        currentServers.push({
            id:interaction.guild.id,
            currentPage:1,
        })
        
        interaction.editReply("Setup Successful")

    }
}
