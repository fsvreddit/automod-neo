/* eslint-disable camelcase */
import _ from "lodash";
import { AutomodRule, SearchMethod, SearchOption } from "../types";
import { parseAllDocuments } from "yaml";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processNode (node: any, nodeName: string) {
    const nodeNameRegex = /^(~?title|~?body|~?title\+body|~?body\+title|~?name|~?id|~?flair_text|~?flair_css_class|~?flair_template_id|~?domain|~?url)(?:#\w+)?(?: \(([\w\s,-]+)\))?$/;
    const matches = nodeNameRegex.exec(nodeName);
    if (matches?.length !== 3) {
        return;
    }

    let properName = matches[1];
    if (!properName) {
        return;
    }

    let searchOptions = matches[2] ?? "";
    const negate = properName.startsWith("~");

    let searchOptionList = searchOptions.split(",").map(x => x.trim());
    const caseSensitive = searchOptionList.includes("case-sensitive") || searchOptionList.includes("case_sensitive");
    if (caseSensitive) {
        searchOptionList = searchOptionList.filter(x => x !== "case-sensitive" && x !== "case_sensitive");
    }

    if (properName.endsWith("title+body") || properName.endsWith("body+title")) {
        properName = (negate ? "~" : "") + "title_or_body";
    }

    searchOptions = searchOptionList.join(", ");

    let options: SearchOption | undefined;
    if (searchOptions || caseSensitive || negate) {
        let searchMethod = (searchOptions.length > 0 ? searchOptions : undefined) as SearchMethod | undefined;
        if (!searchMethod) {
            switch (properName.replace("~", "")) {
                case "domain":
                    searchMethod = "ends-with";
                    break;
                case "id":
                case "flair_text":
                case "flair_css_class":
                case "flair_template_id":
                    searchMethod = "full-exact";
                    break;
                case "url":
                    searchMethod = "includes";
                    break;
                default:
                    searchMethod = "includes-word";
            }
        }

        options = {
            search_method: searchMethod,
            negate,
            case_sensitive: caseSensitive,
        };
    }

    if (properName.startsWith("~")) {
        properName = properName.substring(1);
    }

    if (properName === nodeName && !options) {
        // Nothing to do, node is already properly formatted.
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const newValue = node[nodeName];
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete, @typescript-eslint/no-unsafe-member-access
    delete node[nodeName];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (node[properName] !== undefined && Array.isArray(node[properName])) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        node[properName].push({
            text: Array.isArray(newValue) ? newValue : [newValue],
            options,
        });
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        node[properName] = [{
            text: Array.isArray(newValue) ? newValue : [newValue],
            options,
        }];
    }
}

export function parseRules (rules: string): AutomodRule[] {
    if (!rules.trim()) {
        return [];
    }

    const documents = parseAllDocuments(rules, { strict: true });
    const parsedRules = _.compact(documents.map(doc => doc.toJSON() as AutomodRule | null));

    for (const rule of parsedRules) {
        const nodeNames = Object.keys(rule);
        for (const node of nodeNames) {
            processNode(rule, node);
        }

        if (rule.author) {
            const authorNodeNames = Object.keys(rule.author);
            for (const node of authorNodeNames) {
                processNode(rule.author, node);
            }
        }

        if (rule.subreddit) {
            const subredditNodeNames = Object.keys(rule.subreddit);
            for (const node of subredditNodeNames) {
                processNode(rule.subreddit, node);
            }
        }

        if (rule.parent_submission) {
            const parentSubmissionNodeNames = Object.keys(rule.parent_submission);
            for (const node of parentSubmissionNodeNames) {
                processNode(rule.parent_submission, node);
            }
        }
    }

    return parsedRules;
}
