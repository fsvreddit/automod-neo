import { context, reddit, User } from "@devvit/web/server";
import { Author, Matches } from "../types";
import { meetsDateThreshold, meetsNumericThreshold, searchConditionMatchesInput } from ".";
import { isApprovedUser, isModerator } from "../helpers";

export async function authorMatchesCondition (user: User, isSubmitter: boolean, author: Author): Promise<Matches[] | undefined> {
    const matchesFound: Matches[] = [];

    if (author.id !== undefined) {
        if (!author.id.some(id => user.id === `t2_${id}`)) {
            return;
        }
    }

    if (author.name !== undefined) {
        let foundAMatch = false;
        for (const nameCondition of author.name) {
            const matchedParts = searchConditionMatchesInput(user.username, nameCondition);
            if (matchedParts) {
                matchesFound.push({ category: "author", matches: matchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (author.has_verified_email !== undefined) {
        if (user.hasVerifiedEmail !== author.has_verified_email) {
            return;
        }
    }

    if (author.is_gold !== undefined) {
        if (user.hasRedditPremium !== author.is_gold) {
            return;
        }
    }

    if (author.is_submitter !== undefined) {
        if (isSubmitter !== author.is_submitter) {
            return;
        }
    }

    let anyThresholdMatched: boolean | undefined;

    if (author.comment_karma !== undefined) {
        if (!meetsNumericThreshold(user.commentKarma, author.comment_karma)) {
            if (!author.satisfy_any_threshold) {
                return;
            }
        } else {
            anyThresholdMatched = true;
        }
    }

    if (author.post_karma !== undefined) {
        if (!meetsNumericThreshold(user.linkKarma, author.post_karma)) {
            if (!author.satisfy_any_threshold) {
                return;
            }
        } else {
            anyThresholdMatched = true;
        }
    }

    if (author.combined_karma !== undefined) {
        const combinedKarma = user.commentKarma + user.linkKarma;
        if (!meetsNumericThreshold(combinedKarma, author.combined_karma)) {
            if (!author.satisfy_any_threshold) {
                return;
            }
        } else {
            anyThresholdMatched = true;
        }
    }

    if (author.account_age !== undefined) {
        if (!meetsDateThreshold(user.createdAt, author.account_age)) {
            if (!author.satisfy_any_threshold) {
                return;
            }
        } else {
            anyThresholdMatched = true;
        }
    }

    // More expensive checks that need async calls. Run last to allow for early exit
    if (author.combined_subreddit_karma !== undefined || author.comment_subreddit_karma !== undefined || author.post_subreddit_karma !== undefined) {
        const subredditKarma = await reddit.getUserKarmaFromCurrentSubreddit(user.username);

        if (author.comment_subreddit_karma !== undefined) {
            if (!meetsNumericThreshold(subredditKarma.fromComments ?? 0, author.comment_subreddit_karma)) {
                if (!author.satisfy_any_threshold) {
                    return;
                }
            } else {
                anyThresholdMatched = true;
            }
        }

        if (author.post_subreddit_karma !== undefined) {
            if (!meetsNumericThreshold(subredditKarma.fromPosts ?? 0, author.post_subreddit_karma)) {
                if (!author.satisfy_any_threshold) {
                    return;
                }
            } else {
                anyThresholdMatched = true;
            }
        }

        if (author.combined_subreddit_karma !== undefined) {
            const combinedSubredditKarma = (subredditKarma.fromComments ?? 0) + (subredditKarma.fromPosts ?? 0);
            if (!meetsNumericThreshold(combinedSubredditKarma, author.combined_subreddit_karma)) {
                if (!author.satisfy_any_threshold) {
                    return;
                }
            } else {
                anyThresholdMatched = true;
            }
        }
    }

    if (author.satisfy_any_threshold && anyThresholdMatched === false) {
        return;
    }

    if (author.flair_text !== undefined || author.flair_css_class !== undefined) {
        const flair = await user.getUserFlairBySubreddit(context.subredditName);
        if (!flair) {
            return;
        }

        if (author.flair_text !== undefined) {
            if (!author.flair_text.some(flairTextCondition => searchConditionMatchesInput(flair.flairText ?? "", flairTextCondition))) {
                return;
            }
        }

        if (author.flair_css_class !== undefined) {
            if (!author.flair_css_class.some(flairCssClassCondition => searchConditionMatchesInput(flair.flairCssClass ?? "", flairCssClassCondition))) {
                return;
            }
        }
    }

    if (author.is_contributor !== undefined) {
        const isApproved = await isApprovedUser(user);
        if (isApproved !== author.is_contributor) {
            return;
        }
    }

    if (author.is_moderator !== undefined) {
        const isMod = await isModerator(user);
        if (isMod !== author.is_moderator) {
            return;
        }
    }

    return matchesFound;
}
