import { reddit } from "@devvit/web/server";
import { CommentV2, isT1, T3 } from "@devvit/web/shared";
import { AutomodRule, Matches } from "../types";
import { searchConditionMatchesInput } from "./searchConditionMatcher";
import { normaliseTimestamp } from "../helpers";
import { differenceInMonths } from "date-fns";
import { postMatchesPostCondition } from "./postChecks";

export async function commentMatchesRule (comment: CommentV2, isEdit: boolean, rule: AutomodRule): Promise<Matches[] | undefined> {
    if (rule.type !== undefined && rule.type !== "any" && rule.type !== "comment") {
        return;
    }

    if (rule.id !== undefined) {
        if (!rule.id.some(id => comment.id === `t1_${id}`)) {
            return;
        }
    }

    const matches: Matches[] = [];

    if (rule.body !== undefined) {
        let foundAMatch = false;
        for (const bodyCondition of rule.body) {
            const matchedParts = searchConditionMatchesInput(comment.body, bodyCondition, rule.ignore_blockquotes);
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

    if (rule.title_or_body !== undefined) {
        let foundAMatch = false;
        for (const condition of rule.title_or_body) {
            const bodyMatchedParts = searchConditionMatchesInput(comment.body, condition, rule.ignore_blockquotes);
            if (bodyMatchedParts) {
                matches.push({ category: "body", matches: bodyMatchedParts });
                foundAMatch = true;
                break;
            }
        }
        if (!foundAMatch) {
            return;
        }
    }

    if (rule.reports !== undefined) {
        if (comment.numReports < rule.reports) {
            return;
        }
    }

    if (rule.body_longer_than !== undefined) {
        if (comment.body.length <= rule.body_longer_than) {
            return;
        }
    }

    if (rule.body_shorter_than !== undefined) {
        if (comment.body.length >= rule.body_shorter_than) {
            return;
        }
    }

    if (rule.is_edited !== undefined) {
        if (isEdit !== rule.is_edited) {
            return;
        }
    }

    if (rule.is_top_level !== undefined) {
        const isTopLevel = isT1(comment.parentId);
        if (isTopLevel !== rule.is_top_level) {
            return;
        }
    }

    if (rule.past_archive_date !== undefined) {
        const isPastArchiveDate = differenceInMonths(new Date(), normaliseTimestamp(comment.createdAt)) > 6;
        if (isPastArchiveDate !== rule.past_archive_date) {
            return;
        }
    }

    if (rule.comment_crowd_control_collapsed !== undefined) {
        if (comment.collapsedBecauseCrowdControl !== rule.comment_crowd_control_collapsed) {
            return;
        }
    }

    if (rule.parent_submission !== undefined) {
        const parentSubmission = await reddit.getPostById(comment.postId as T3);
        if (!await postMatchesPostCondition(parentSubmission, rule.parent_submission)) {
            return;
        }
    }

    return matches;
}
