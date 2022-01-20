const {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} = require("discord-interactions");

const getRawBody = require("raw-body");
const fetch = require('node-fetch');

/**
 * Create a Reddit embed
 * @param {discord.Interaction} interaction 
 * @returns 
 */
 async function reddit(options){
  const fullurl = options[0]["value"]
  if (fullurl == undefined || !fullurl.includes("reddit.com")){
    return{
      type: 4,
      data: {
        content: ":x: Not a Reddit URL",
        flags: 1<<6 //ephemeral
      },
    }
  }

  function trimTrailingChars(s, charToTrim) {
    const regExp = new RegExp(charToTrim + "+$");
    return s.replace(regExp, "");
}

  async function doit(){
    const url = `${trimTrailingChars(fullurl.split('?')[0],'/')}.json`
    let data = await fetch(url).catch(()=>{});
    if (data.status != 200){
      return {
        type: 4,
        data: {
          content: ":x: Reddit page not reachable",
          flags: 1<<6 //ephemeral
        },
      }
    }
    data = await data.json();

    const postcontent = data[0]["data"]["children"][0]["data"];

    let subData = await fetch(`https://www.reddit.com/r/${postcontent["subreddit"]}/about.json`)
    subData = await subData.json();
    
    const response = {
      type:4,
      data:{
        embeds:[
          {
            title:postcontent["title"].substring(0,255),
            description:postcontent["selftext"].substring(0,4095),
            url:fullurl,
            color:0x00AEFF,
            thumbnail:{
              url:subData["data"]["header_img"]
            },
            author:{
              name:`u/${postcontent["author"]} on ${postcontent["subreddit_name_prefixed"]}`,
              icon_url:subData["data"]["icon_img"]
            },
            footer:{
              text:`⬆ ✖ ${postcontent["score"]}           💬 ✖ ${postcontent["num_comments"]}`
            }
          }
        ]
      }
    };
     // add the image if there is one
     if (postcontent["url"].includes(".jpg") || postcontent["url"].includes(".png")){
      response.data.embeds[0]["image"] = {}; 
      response.data.embeds[0]["image"]["url"] = postcontent["url"];
    }
    else if (postcontent.hasOwnProperty("gallery_data")){
      response.data.embeds[0]["image"] = {}
      const firstGalleryID = postcontent["gallery_data"]["items"][0]["media_id"];
      const firstGalleryMime = postcontent["media_metadata"][firstGalleryID]['m'];
      const firstGalleryExt = firstGalleryMime.replace('image/','');
      response.data.embeds[0]["image"]["url"] = `https://i.redd.it/${firstGalleryID}.${firstGalleryExt}`
      // indicate number of images
      response.data.embeds[0]["fields"] = []
      response.data.embeds[0]["fields"][0] = {
        name:"Gallery",
        value:`${postcontent["gallery_data"]["items"].length-1} more images in gallery`
      }
    }

    return response;
  }
  return await doit();
}

/**
 * @param {VercelRequest} request
 * @param {VercelResponse} response
 */
module.exports = async (request, response) => {

  // Only respond to POST requests
  if (request.method === "POST") {
    // Verify the request (required for Discord API)
    const signature = request.headers["x-signature-ed25519"];
    const timestamp = request.headers["x-signature-timestamp"];
    const rawBody = await getRawBody(request);

    const isValidRequest = verifyKey(
      rawBody,
      signature,
      timestamp,
      process.env.PUBLIC_KEY
    );

    if (!isValidRequest) {
      return response.status(401).send({ error: "Bad request signature" });
    }

    // Handle the request
    const message = request.body;

    // Handle PINGs from Discord (also required for the API)
    if (message.type === InteractionType.PING) {
      response.send({
        type: InteractionResponseType.PONG,
      });

    } else if (message.type === InteractionType.APPLICATION_COMMAND) {
      // Handle our Slash Commands
      switch (message.data.name.toLowerCase()) {
        case "reddit":   
          response.status(200).send(await reddit(message.data.options));
          break;
        default:
          response.status(400).send({ error: "Unknown Command" });
          break;
      }

    } else {
      response.status(400).send({ error: "Unknown Type" });
    }
  }
  else{
    response.status(400).send({ error: "Not a POST request" });
  }
};