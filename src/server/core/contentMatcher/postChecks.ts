/* eslint-disable camelcase */
import { Post, reddit } from "@devvit/web/server";
import { AutomodRule, Matches, PostCondition } from "../types";
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

                if (!await authorMatchesCondition(crosspostAuthor, false, condition.crosspost_author)) {
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

    const postChecks: PostCondition = {
        id: rule.id,
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
