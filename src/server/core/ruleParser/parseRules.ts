/* eslint-disable camelcase */
import _ from "lodash";
import { AutomodRule, SearchMethod, SearchOption, SearchableText } from "../types";
import { parseAllDocuments } from "yaml";
import Ajv from "ajv";
import { automodSchema } from "./automodSchema";

const searchMethodValues: SearchMethod[] = ["includes-word", "includes", "starts-with", "ends-with", "full-exact", "regex"];

const topLevelSearchableFields = new Set([
    "id",
    "title",
    "body",
    "title_or_body",
    "domain",
    "url",
    "flair_text",
    "flair_css_class",
    "flair_template_id",
    "crosspost_title",
    "media_author",
    "media_author_url",
    "media_title",
    "media_description",
]);
const authorSearchableFields = new Set(["id", "name", "flair_text", "flair_css_class", "display_name", "bio_text", "social_links"]);
const subredditSearchableFields = new Set(["name"]);

type MutableNode = Record<string, unknown>;

function isObjectRecord (value: unknown): value is MutableNode {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray (value: unknown): string[] | undefined {
    if (typeof value === "string") {
        return [value];
    }

    if (Array.isArray(value) && value.every(item => typeof item === "string")) {
        return value;
    }

    return undefined;
}

function toSearchableText (value: unknown, searchField: SearchableText["searchField"], options?: SearchOption): SearchableText | undefined {
    const text = toStringArray(value);
    if (!text) {
        return undefined;
    }

    const searchableText: SearchableText = {
        searchField,
        text,
    };

    if (options) {
        searchableText.options = options;
    }

    return searchableText;
}

function defaultSearchMethodForField (fieldName: string): SearchMethod {
    switch (fieldName) {
        case "id":
            return "full-exact";
        case "domain":
            return "ends-with";
        case "flair_text":
        case "flair_css_class":
        case "flair_template_id":
        case "media_author":
            return "full-exact";
        case "url":
        case "media_author_url":
            return "includes";
        default:
            return "includes-word";
    }
}

function buildSearchOptions (fieldName: string, qualifierText: string | undefined, negate: boolean): SearchOption | undefined {
    const rawParts = (qualifierText ?? "").split(",").map(part => part.trim()).filter(Boolean);
    const caseSensitive = rawParts.includes("case-sensitive") || rawParts.includes("case_sensitive");
    const parts = rawParts.filter(part => part !== "case-sensitive" && part !== "case_sensitive");

    const searchMethodCandidate = parts.length > 0 ? parts.join(", ") : undefined;
    const searchMethod = searchMethodCandidate && searchMethodValues.includes(searchMethodCandidate as SearchMethod)
        ? searchMethodCandidate as SearchMethod
        : defaultSearchMethodForField(fieldName);

    if (!qualifierText && !negate && fieldName !== "id") {
        return undefined;
    }

    return {
        search_method: searchMethod,
        negate,
        case_sensitive: caseSensitive,
    };
}

function parseSearchableKey (rawKey: string): { fieldNames: string[]; primaryField: string; qualifierText: string | undefined; negate: boolean } | undefined {
    const keyMatch = /^(~?[a-z_+]+)(?:#\w+)?(?: \(([\w\s,-]+)\))?$/.exec(rawKey);
    if (!keyMatch) {
        return undefined;
    }

    const maybeNegatedName = keyMatch[1];
    if (!maybeNegatedName) {
        return undefined;
    }

    const qualifierText = keyMatch[2];
    const negate = maybeNegatedName.startsWith("~");
    const normalizedName = negate ? maybeNegatedName.slice(1) : maybeNegatedName;
    const [primaryField, ...additionalFieldNames] = normalizedName.split("+").filter(Boolean);
    if (!primaryField) {
        return undefined;
    }

    const fieldNames = [primaryField, ...additionalFieldNames];

    return {
        fieldNames,
        primaryField,
        qualifierText,
        negate,
    };
}

function appendSearchableValue (node: MutableNode, fieldName: string, searchableValue: SearchableText): void {
    const existing = node[fieldName];
    if (!Array.isArray(existing)) {
        node[fieldName] = [searchableValue];
        return;
    }

    existing.push(searchableValue);
}

function preprocessSearchableFields (node: MutableNode, searchableFields: Set<string>, searchConditionsFieldName: string): void {
    for (const rawKey of Object.keys(node)) {
        const parsedKey = parseSearchableKey(rawKey);
        if (!parsedKey) {
            continue;
        }

        if (!parsedKey.fieldNames.every(fieldName => searchableFields.has(fieldName))) {
            continue;
        }

        const searchableValue = toSearchableText(node[rawKey], parsedKey.fieldNames as SearchableText["searchField"], buildSearchOptions(parsedKey.primaryField, parsedKey.qualifierText, parsedKey.negate));
        if (!searchableValue) {
            continue;
        }

        // Delete decorated key versions (negation/suffix/qualifiers) and append normalized entry.
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete node[rawKey];

        appendSearchableValue(node, searchConditionsFieldName, searchableValue);
    }
}

function preprocessStringArrayField (node: MutableNode, fieldName: "crosspost_id"): void {
    for (const rawKey of Object.keys(node)) {
        const keyMatch = /^(~?[a-z_+]+)(?:#\w+)?(?: \(([\w\s,-]+)\))?$/.exec(rawKey);
        if (!keyMatch) {
            continue;
        }

        const maybeNegatedName = keyMatch[1];
        if (!maybeNegatedName) {
            continue;
        }
        const isNegated = maybeNegatedName.startsWith("~");
        const normalizedField = isNegated ? maybeNegatedName.slice(1) : maybeNegatedName;

        if (normalizedField !== fieldName || isNegated) {
            continue;
        }

        const stringArray = toStringArray(node[rawKey]);
        if (!stringArray) {
            continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete node[rawKey];
        const existing = node[fieldName];
        if (!Array.isArray(existing)) {
            node[fieldName] = [...stringArray];
            continue;
        }

        existing.push(...stringArray);
    }
}

function preprocessAuthorNode (node: MutableNode): void {
    preprocessSearchableFields(node, authorSearchableFields, "search_conditions");
}

function preprocessSubredditNode (node: MutableNode): void {
    preprocessSearchableFields(node, subredditSearchableFields, "search_conditions");
}

function preprocessPostConditionLikeNode (node: MutableNode): void {
    preprocessStringArrayField(node, "crosspost_id");
    preprocessSearchableFields(node, topLevelSearchableFields, "search_conditions");

    if (isObjectRecord(node.author)) {
        preprocessAuthorNode(node.author);
    }

    if (isObjectRecord(node.subreddit)) {
        preprocessSubredditNode(node.subreddit);
    }

    if (isObjectRecord(node.crosspost_author)) {
        preprocessAuthorNode(node.crosspost_author);
    }

    if (isObjectRecord(node.crosspost_subreddit)) {
        preprocessSubredditNode(node.crosspost_subreddit);
    }
}

function validateRegexPatternsInSearchableField (node: MutableNode, fieldName: string, nodePath: string): void {
    const fieldValue = node[fieldName];
    if (!Array.isArray(fieldValue)) {
        return;
    }

    const searchableItems = fieldValue as unknown[];
    for (let searchableIndex = 0; searchableIndex < searchableItems.length; searchableIndex += 1) {
        const searchableItem = searchableItems[searchableIndex];
        if (!isObjectRecord(searchableItem)) {
            continue;
        }

        const optionsValue = searchableItem.options;
        if (!isObjectRecord(optionsValue) || optionsValue.search_method !== "regex") {
            continue;
        }

        const textValue = searchableItem.text;
        if (!Array.isArray(textValue)) {
            continue;
        }

        const textPatterns = textValue as unknown[];
        for (let textIndex = 0; textIndex < textPatterns.length; textIndex += 1) {
            const pattern = textPatterns[textIndex];
            if (typeof pattern !== "string") {
                continue;
            }

            try {
                // Validate regex syntax early so malformed rules fail with a clear path.
                new RegExp(pattern, "u");
            } catch (error) {
                const details = error instanceof Error ? error.message : String(error);
                throw new Error(`Invalid regex pattern at ${nodePath}.${fieldName}[${searchableIndex}].text[${textIndex}]: ${pattern} (${details})`);
            }
        }
    }
}

function validateRegexPatternsInAuthorNode (node: MutableNode, nodePath: string): void {
    validateRegexPatternsInSearchableField(node, "search_conditions", nodePath);
}

function validateRegexPatternsInSubredditNode (node: MutableNode, nodePath: string): void {
    validateRegexPatternsInSearchableField(node, "search_conditions", nodePath);
}

function validateRegexPatternsInPostConditionLikeNode (node: MutableNode, nodePath: string): void {
    validateRegexPatternsInSearchableField(node, "search_conditions", nodePath);

    if (isObjectRecord(node.author)) {
        validateRegexPatternsInAuthorNode(node.author, `${nodePath}.author`);
    }

    if (isObjectRecord(node.subreddit)) {
        validateRegexPatternsInSubredditNode(node.subreddit, `${nodePath}.subreddit`);
    }

    if (isObjectRecord(node.crosspost_author)) {
        validateRegexPatternsInAuthorNode(node.crosspost_author, `${nodePath}.crosspost_author`);
    }

    if (isObjectRecord(node.crosspost_subreddit)) {
        validateRegexPatternsInSubredditNode(node.crosspost_subreddit, `${nodePath}.crosspost_subreddit`);
    }
}

export function validateRuleRegexPatterns (rule: MutableNode, rulePath: string): void {
    validateRegexPatternsInPostConditionLikeNode(rule, rulePath);

    if (isObjectRecord(rule.parent_submission)) {
        validateRegexPatternsInPostConditionLikeNode(rule.parent_submission, `${rulePath}.parent_submission`);
    }
}

export function preprocessRule (rule: MutableNode): void {
    preprocessPostConditionLikeNode(rule);

    if (isObjectRecord(rule.parent_submission)) {
        preprocessPostConditionLikeNode(rule.parent_submission);
    }
}

export function parseRules (rules: string): AutomodRule[] {
    if (!rules.trim()) {
        return [];
    }

    const documents = parseAllDocuments(rules, { strict: true });
    const parsedRules = _.compact(documents.map(doc => doc.toJSON() as MutableNode | null));

    for (const [index, rule] of parsedRules.entries()) {
        preprocessRule(rule);
        validateRuleRegexPatterns(rule, `rule[${index}]`);
    }

    const ajv = new Ajv({
        coerceTypes: "array",
    });
    const validate = ajv.compile(automodSchema);

    // Validate rules against schema one by one
    for (const rule of parsedRules) {
        if (!validate(rule)) {
            console.error("Invalid rule:", rule);
            console.error("Validation errors:", validate.errors);
            throw new Error(`Rule failed validation: ${ajv.errorsText(validate.errors)}`);
        }
    }

    return parsedRules;
}
