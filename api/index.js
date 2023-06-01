const fetch = require('node-fetch');

/**
 * Create a Reddit embed
 * @param {discord.Interaction} interaction 
 * @returns Discord Embed Object
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
          },
        ]
      }
    };

    function addFieldData(){
      if(response.data.embeds[0]["fields"] == undefined){
        response.data.embeds[0]["fields"] = []
      }
    }
     // add the image if there is one
     if (postcontent["url"].includes(".jpg") || postcontent["url"].includes(".png")){
      response.data.embeds[0]["image"] = {}; 
       if (postcontent["over_18"]){
        response.data.embeds[0]["image"]["url"] = `https://${process.env.VERCEL_URL}/img/not_safe.png`;
       }
       else{
        response.data.embeds[0]["image"]["url"] = postcontent["url"];
       }
      
    }
    else if (postcontent.hasOwnProperty("gallery_data")){
      response.data.embeds[0]["image"] = {}
      const firstGalleryID = postcontent["gallery_data"]["items"][0]["media_id"];
      const firstGalleryMime = postcontent["media_metadata"][firstGalleryID]['m'];
      const firstGalleryExt = firstGalleryMime.replace('image/','');
      if (postcontent["over_18"]){
        response.data.embeds[0]["image"]["url"] = `https://${process.env.VERCEL_URL}/img/not_safe.png`;
      }
      else{
        response.data.embeds[0]["image"]["url"] = `https://i.redd.it/${firstGalleryID}.${firstGalleryExt}`
      }
      // indicate number of images
      addFieldData();
      response.data.embeds[0]["fields"][0] = {
        name:"Gallery",
        value:`${postcontent["gallery_data"]["items"].length-1} more images in gallery`
      }
    }

    // flairs
    if (postcontent["link_flair_text"] != undefined && postcontent["link_flair_text"] != ""){
      addFieldData();
      response.data.embeds[0]["fields"].push({
        name: "Flair",
        value: postcontent["link_flair_text"]
      });
    }

    // is this a comment?
    if (fullurl.includes("/comment/")){
      const commentcontent = data[1]["data"]["children"][0]["data"];
      // add an additional embed
      response.data.embeds.push({
        description:commentcontent["body"],
        url:`${fullurl}?comment=1`,   // see https://github.com/discord/discord-api-docs/issues/4129#issuecomment-974749409
        color:0x00AEFF,
        author:{
          name:`Reply by u/${commentcontent["author"]}`,
          icon_url:"https://www.redditstatic.com/avatars/avatar_default_02_FF4500.png"
        },
        footer:{
          text:`⬆ ✖ ${commentcontent["score"]}`
        }
      })
    }
    return response;
  }
  return await doit();
}

/**
 * Generic "best-guess" embed, for when a site does not properly embed itself
 * @param {discord.Interaction} options 
 * @returns Discord Embed Object
 */
async function genericembed(options){
  const fullurl = options[0]["value"]
  if (!fullurl.includes("http")){
    return{
      type: 4,
      data: {
        content: ":x: Not a URL",
        flags: 1<<6 //ephemeral
      },
    }
  }
  if (fullurl.includes("reddit.com")){
    return await reddit(options);
  }

  // load jsdom
  const jsdom = require("jsdom");
  const { JSDOM } = jsdom;
  const re = await fetch(fullurl);
  if (re.status != 200){
    return{
      type: 4,
      data: {
        content: `:x: Cannot embed - the webpage at ${fullurl} responded with status ${re.status} - ${re.statusText}`,
        flags: 1<<6 //ephemeral
      },
    }
  }
  const str = await re.text();
  const dom = new JSDOM(str);

  let title = dom.window.document.querySelector('title');
  if (title){
    title = title.textContent;
  }
  else{
    // try again:
    title = dom.window.document.querySelector("[property~='og:site_name'][content]")
    if (title){
      title = title.content;
    }
    else{
      return{
        type: 4,
        data: {
          content: ":x: Cannot embed - webpage does not have a title",
          flags: 1<<6 //ephemeral
        },
      }
    }
  }
  let description = dom.window.document.querySelector('[name~=description][content]');
  if (description){
    description = description.content;
  }
  else{
    description = "";
  }
  let imgurl = dom.window.document.querySelector("[property~='og:image'][content]");
  if (imgurl){
    imgurl = imgurl.content;
  }

  let authorname = dom.window.document.querySelector("[property~='og:site_name'][content]");
  if (authorname){
    authorname = authorname.content;
  }
  let icon = dom.window.document.querySelector("[rel~='icon'][href]");
  if (icon){
    icon = icon.href;
    // fixup icon url
    if (icon.startsWith('//')){
      icon = `http:${icon}`;
    }
    else if (icon.startsWith('/')){
      icon = `http:/${icon}`;
    }
  }
  let date = dom.window.document.querySelector("[property~='article:published_time'][content]");
  if (date){
    date = ` on ${new Date(date.content).toLocaleDateString()}`;
  }
  else{
    date = "";
  }

  const response = {
    type:4,
    data:{
      embeds:[
        {
          title:title.substring(0,255),
          description:description.substring(0,4095),
          url:fullurl,
          color:0x00AEFF,
          author:{
            name:`${authorname}${date}`,
            icon_url:icon
          },
          image:{
            url:imgurl
          },
        }
      ]
    }
  };

  if (!authorname){ 
    // discord won't send the embed for some reason if this is not properly defined
    response["data"]["embeds"][0]["author"] = undefined
  }

  return response;
}

/**
 * @param {VercelRequest} request
 * @param {VercelResponse} response
 */
module.exports = async (request, response) => {

  // Only respond to POST requests
  if (request.method === "POST") {
    const {
      InteractionResponseType,
      InteractionType,
      verifyKey,
    } = require("discord-interactions");
    
    const getRawBody = require("raw-body");
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
        case "embed":
          response.status(200).send(await genericembed(message.data.options));
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

