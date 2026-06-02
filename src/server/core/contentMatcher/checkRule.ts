import { reddit, User } from "@devvit/web/server";
import { OnCommentCreateRequest, OnCommentUpdateRequest, OnPostCreateRequest, OnPostUpdateRequest, T2, T3 } from "@devvit/web/shared";
import { AutomodMatch, AutomodRule, Matches } from "../types";
import { commentMatchesRule } from "./commentChecks";
import { postMatchesRule } from "./postChecks";
import { authorMatchesCondition } from "./authorChecks";
import { isModerator } from "../helpers";
import { hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { addMinutes } from "date-fns";
import { AppSetting, getSettings } from "../appSettings";
import { parseRules } from "../ruleParser";

async function getRulesForSubreddit (): Promise<AutomodRule[]> {
    const appSettings = await getSettings();
    return parseRules(appSettings[AppSetting.Rules]);
}

export async function checkComment (request: OnCommentCreateRequest | OnCommentUpdateRequest, isEdit: boolean): Promise<AutomodMatch | undefined> {
    if (!request.comment || !request.author) {
        throw new Error("No comment in request");
    }

    if (await hasTriggerBeenHandled(`comment:${request.comment.id}:${isEdit}`, { expiration: addMinutes(new Date(), 10) })) {
        return;
    }

    const rules = await getRulesForSubreddit();
    if (rules.length === 0) {
        return;
    }

    let user: User | undefined;

    for (const rule of rules) {
        const matches: Matches[] = [];

        const commentCheckResult = await commentMatchesRule(request.comment, isEdit, rule);
        if (!commentCheckResult) {
            continue;
        }

        matches.push(...commentCheckResult);

        if (rule.author) {
            user ??= await reddit.getUserById(request.author.name as T2);
            if (!user) {
                continue;
            }

            const authorMatches = await authorMatchesCondition(user, false, rule.author);
            if (!authorMatches) {
                continue;
            }

            matches.push(...authorMatches);
        }

        if (rule.moderators_exempt !== undefined) {
            user ??= await reddit.getUserById(request.author.name as T2);
            if (!user) {
                continue;
            }

            const isMod = await isModerator(user);
            if (isMod && rule.moderators_exempt) {
                continue;
            }
        }

        return { rule, matches };
    }
}

export async function checkPost (request: OnPostCreateRequest | OnPostUpdateRequest): Promise<AutomodMatch | undefined> {
    if (!request.post?.id) {
        throw new Error("No post in request");
    }

    const rules = await getRulesForSubreddit();
    if (rules.length === 0) {
        return;
    }

    let user: User | undefined;

    const post = await reddit.getPostById(request.post.id as T3);

    if (await hasTriggerBeenHandled(`post:${request.post.id}:${post.edited}`)) {
        return;
    }

    for (const rule of rules) {
        const matches: Matches[] = [];

        const postCheckResult = await postMatchesRule(post, rule);
        if (!postCheckResult) {
            continue;
        }

        matches.push(...postCheckResult);

        if (rule.author) {
            user ??= await reddit.getUserById(post.authorName as T2);
            if (!user) {
                continue;
            }

            const authorMatches = await authorMatchesCondition(user, true, rule.author);
            if (!authorMatches) {
                continue;
            }

            matches.push(...authorMatches);
        }

        if (rule.moderators_exempt !== undefined) {
            user ??= await reddit.getUserById(post.authorName as T2);
            if (!user) {
                continue;
            }

            const isMod = await isModerator(user);
            if (isMod && rule.moderators_exempt) {
                continue;
            }
        }

        return { rule, matches };
    }
}
