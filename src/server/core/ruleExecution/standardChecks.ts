import { Post } from "@devvit/web/server";
import { getDomainFromUrl } from "../helpers";
import { StandardCondition } from "../types";

export function postMatchesStandardCondition (post: Post, condition: StandardCondition): boolean {
    if (condition === "image hosting sites") {
        const domains = ["500px.com", "abload.de", "anony.ws", "deviantart.com", "deviantart.net", "fav.me", "fbcdn.net", "flickr.com", "forgifs.com", "giphy.com", "gfycat.com", "gifs.com", "gifsoup.com", "gyazo.com", "imageshack.us", "imgclean.com", "imgur.com", "instagr.am", "instagram.com", "i.reddituploads.com", "mediacru.sh", "media.tumblr.com", "min.us", "minus.com", "myimghost.com", "photobucket.com", "picsarus.com", "postimg.org", "puu.sh", "i.redd.it", "sli.mg", "staticflickr.com", "tinypic.com", "twitpic.com", "ibb.co"];
        const domain = getDomainFromUrl(post.url);
        return domain ? domains.includes(domain) : false;
    } else if (condition === "direct image links") {
        const regex = /\.(jpe?g|png|gifv?)(\?\S*)?$/i;
        return regex.test(post.url);
    } else if (condition === "streaming sites") {
        const domains = ["twitch.tv", "livestream.com", "azubu.tv", "hitbox.tv", "ustream.tv"];
        const domain = getDomainFromUrl(post.url);
        if (domain === "content.azubu.tv") {
            return false; // Exclude Azubu VODs
        }
        return domain ? domains.includes(domain) : false;
    } else if (condition === "video hosting sites") {
        const domains = ["youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "liveleak.com", "mediacru.sh", "worldstarhiphop.com", "gfycat.com", "vid.me"];
        const domain = getDomainFromUrl(post.url);
        return domain ? domains.includes(domain) : false;
    } else if (condition === "meme generator sites") {
        const domains = ["9gag.com", "cheezburger.com", "chzbgr.com", "diylol.com", "dropmeme.com", "generatememes.com", "ifunny.co", "imgflip.com", "ismeme.com", "livememe.com", "makeameme.org", "meme-generator.org", "memecaptain.com", "memecenter.com", "memecloud.net", "memecreator.org", "memecrunch.com", "memedad.com", "memegen.com", "memegenerator.co", "memegenerator.net", "mememaker.net", "memesly.com", "memesnap.com", "minimemes.net", "onsizzle.com", "pressit.co", "qkme.me", "quickmeme.com", "ratemymeme.com", "sizzle.af", "troll.me", "weknowmemes.com", "winmeme.com", "wuzu.se"];
        const domain = getDomainFromUrl(post.url);
        return domain ? domains.includes(domain) : false;
    } else if (condition === "facebook links") {
        const regexes = [
            /facebook\.com/i,
            /fbcdn\.net/i,
            /fb\.com/i,
            /fb\.me/i,
            /fbcdn-s?photos-.*?\.akamaihd\.net/i,
        ];
        return regexes.some(regex => regex.test(post.url) || regex.test(post.body ?? ""));
    } else if (condition === "amazon affiliate links") {
        const regex = /(amazon|amzn)\.(com|co\.uk|ca)\S+?tag=/i;
        return regex.test(post.url) || regex.test(post.body ?? "");
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (condition === "crowdfunding sites") {
        const domains = ["crowdrise.com", "kickstarter.com", "kck.st", "giveforward.com", "gogetfunding.com", "indiegogo.com", "igg.me", "generosity.com", "gofundme.com", "patreon.com", "prefundia.com", "razoo.com", "totalgiving.co.uk", "youcaring.com", "youcaring.net", "youcaring.org", "petcaring.com", "walacea.com"];
        const domain = getDomainFromUrl(post.url);
        return domain ? domains.includes(domain) : false;
    } else {
        throw new Error(`Unknown standard condition: ${condition}`);
    }
}
