/* eslint-disable camelcase */
import { Post, reddit } from "@devvit/web/server";
import { AutomodRule, Matches, PostCondition, StandardCondition } from "../types";
import { searchConditionMatchesInput } from "./searchConditionMatcher";
import { getDomainFromUrl, isSubredditNSFW } from "../helpers";
import { differenceInMonths } from "date-fns";
import { authorMatchesCondition } from "./authorChecks";

export async function postMatchesPostCondition (post: Post, condition: PostCondition): Promise<Matches[] | undefined> {
    if (condition.id !== undefined) {
        if (!condition.id.some(id => post.id === `t3_${id}`)) {
            return;
        }
    }

    if (condition.standard !== undefined) {
        if (!postMatchesStandardCondition(post, condition.standard)) {
            return;
        }
    }

    const matches: Matches[] = [];

    if (condition.title !== undefined) {
        let foundAMatch = false;
        for (const titleCondition of condition.title) {
            const matchedParts = searchConditionMatchesInput(post.title, titleCondition, condition.ignore_blockquotes);
            if (matchedParts) {
                matches.push({ category: "title", matches: matchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (condition.body !== undefined) {
        let foundAMatch = false;
        for (const bodyCondition of condition.body) {
            const matchedParts = searchConditionMatchesInput(post.body ?? "", bodyCondition, condition.ignore_blockquotes);
            if (matchedParts) {
                matches.push({ category: "body", matches: matchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (condition.title_or_body !== undefined) {
        let foundAMatch = false;
        for (const titleOrBodyCondition of condition.title_or_body) {
            const titleMatches = searchConditionMatchesInput(post.title, titleOrBodyCondition, condition.ignore_blockquotes);
            if (titleMatches) {
                matches.push({ category: "title", matches: titleMatches });
                foundAMatch = true;
                break;
            }

            const bodyMatches = searchConditionMatchesInput(post.body ?? "", titleOrBodyCondition, condition.ignore_blockquotes);
            if (bodyMatches) {
                matches.push({ category: "body", matches: bodyMatches });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (condition.domain !== undefined) {
        let foundAMatch = false;
        const postDomain = getDomainFromUrl(post.url);
        for (const domainCondition of condition.domain) {
            const matchedParts = searchConditionMatchesInput(postDomain ?? "", domainCondition);
            if (matchedParts) {
                matches.push({ category: "domain", matches: matchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (condition.url !== undefined) {
        let foundAMatch = false;
        for (const urlCondition of condition.url) {
            const matchedParts = searchConditionMatchesInput(post.url, urlCondition);
            if (matchedParts) {
                matches.push({ category: "url", matches: matchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (condition.flair_text !== undefined) {
        let foundAMatch = false;
        for (const flairTextCondition of condition.flair_text) {
            const matchedParts = searchConditionMatchesInput(post.flair?.text ?? "", flairTextCondition);
            if (matchedParts) {
                matches.push({ category: "flair_text", matches: matchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (condition.media_author !== undefined) {
        let foundAMatch = false;
        for (const mediaAuthorCondition of condition.media_author) {
            const matchedParts = searchConditionMatchesInput(post.secureMedia?.oembed?.authorName ?? "", mediaAuthorCondition);
            if (matchedParts) {
                matches.push({ category: "media_author", matches: matchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (condition.media_author_url !== undefined) {
        let foundAMatch = false;
        for (const mediaAuthorUrlCondition of condition.media_author_url) {
            const matchedParts = searchConditionMatchesInput(post.secureMedia?.oembed?.authorUrl ?? "", mediaAuthorUrlCondition);
            if (matchedParts) {
                matches.push({ category: "media_author_url", matches: matchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (condition.media_title !== undefined) {
        let foundAMatch = false;
        for (const mediaTitleCondition of condition.media_title) {
            const matchedParts = searchConditionMatchesInput(post.secureMedia?.oembed?.title ?? "", mediaTitleCondition);
            if (matchedParts) {
                matches.push({ category: "media_title", matches: matchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (condition.media_description !== undefined) {
        let foundAMatch = false;
        for (const mediaDescriptionCondition of condition.media_description) {
            const matchedParts = searchConditionMatchesInput(post.secureMedia?.oembed?.html ?? "", mediaDescriptionCondition);
            if (matchedParts) {
                matches.push({ category: "media_description", matches: matchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (condition.flair_css_class !== undefined) {
        if (!condition.flair_css_class.some(flairCssCondition => searchConditionMatchesInput(post.flair?.cssClass ?? "", flairCssCondition))) {
            return;
        }
    }

    if (condition.flair_template_id !== undefined) {
        if (!condition.flair_template_id.some(flairTemplateCondition => searchConditionMatchesInput(post.flair?.templateId ?? "", flairTemplateCondition))) {
            return;
        }
    }

    if (condition.reports !== undefined) {
        if (post.numberOfReports < condition.reports) {
            return;
        }
    }

    if (condition.body_longer_than !== undefined) {
        if ((post.body?.length ?? 0) <= condition.body_longer_than) {
            return;
        }
    }

    if (condition.body_shorter_than !== undefined) {
        if ((post.body?.length ?? 0) >= condition.body_shorter_than) {
            return;
        }
    }

    if (condition.is_edited !== undefined) {
        if (post.edited !== condition.is_edited) {
            return;
        }
    }

    if (condition.is_poll !== undefined) {
        const isPoll = post.pollData !== undefined;
        if (isPoll !== condition.is_poll) {
            return;
        }
    }

    if (condition.is_gallery !== undefined) {
        const isGallery = post.gallery.length > 0;
        if (isGallery !== condition.is_gallery) {
            return;
        }
    }

    if (condition.past_archive_date !== undefined) {
        const isPastArchiveDate = differenceInMonths(new Date(), post.createdAt) > 6;
        if (isPastArchiveDate !== condition.past_archive_date) {
            return;
        }
    }

    if (condition.subreddit?.name !== undefined) {
        if (!condition.subreddit.name.some(subredditNameCondition => searchConditionMatchesInput(post.subredditName, subredditNameCondition))) {
            return;
        }
    }

    // Async checks
    if (condition.subreddit?.is_nsfw !== undefined) {
        if (await isSubredditNSFW(post.subredditName) !== condition.subreddit.is_nsfw) {
            return;
        }
    }

    if (condition.crosspost_id !== undefined) {
        if (!condition.crosspost_id.some(id => post.crosspostParentId === `t3_${id}`)) {
            return;
        }
    }

    if (condition.crosspost_author !== undefined || condition.crosspost_title !== undefined || condition.crosspost_subreddit !== undefined) {
        if (!post.crosspostParentId) {
            return;
        }
        const crosspost = await reddit.getPostById(post.crosspostParentId);

        if (condition.crosspost_author !== undefined && crosspost.authorId) {
            try {
                const crosspostAuthor = await reddit.getUserById(crosspost.authorId);
                if (!crosspostAuthor) {
                    return;
                }

                if (!await authorMatchesCondition(crosspostAuthor, false, undefined, condition.crosspost_author)) {
                    return;
                }
            } catch {
                return;
            }
        }

        if (condition.crosspost_title !== undefined) {
            if (!condition.crosspost_title.some(titleCondition => searchConditionMatchesInput(crosspost.title, titleCondition))) {
                return;
            }
        }

        if (condition.crosspost_subreddit?.name !== undefined) {
            if (!condition.crosspost_subreddit.name.some(subredditNameCondition => searchConditionMatchesInput(crosspost.subredditName, subredditNameCondition))) {
                return;
            }
        }

        if (condition.crosspost_subreddit?.is_nsfw !== undefined) {
            if (await isSubredditNSFW(crosspost.subredditName) !== condition.crosspost_subreddit.is_nsfw) {
                return;
            }
        }
    }

    return matches;
}

export async function postMatchesRule (post: Post, rule: AutomodRule) {
    if (rule.type === "comment") {
        return false;
    }

    if (rule.type === "text submission" && !post.body) {
        return false;
    }

    if (rule.type === "link submission" && post.url.includes(post.permalink)) {
        return false;
    }

    if (rule.type === "crosspost submission" && !post.crosspostParentId) {
        return false;
    }

    if (rule.type === "poll submission" && !post.pollData) {
        return false;
    }

    if (rule.type === "gallery submission" && post.gallery.length === 0) {
        return false;
    }

    const postChecks: PostCondition = {
        id: rule.id,
        standard: rule.standard,
        title: rule.title,
        body: rule.body,
        title_or_body: rule.title_or_body,
        ignore_blockquotes: rule.ignore_blockquotes,
        domain: rule.domain,
        url: rule.url,
        flair_text: rule.flair_text,
        flair_css_class: rule.flair_css_class,
        flair_template_id: rule.flair_template_id,
        reports: rule.reports,
        body_longer_than: rule.body_longer_than,
        body_shorter_than: rule.body_shorter_than,
        is_edited: rule.is_edited,
        is_poll: rule.is_poll,
        is_gallery: rule.is_gallery,
        past_archive_date: rule.past_archive_date,
        subreddit: rule.subreddit,
    };

    return await postMatchesPostCondition(post, postChecks);
}

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
