/* eslint-disable camelcase */
import _ from "lodash";
import { AutomodRule, SearchField, SearchMethod, SearchOption, SearchableText } from "../types";
import { parseAllDocuments } from "yaml";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import { automodSchema } from "./automodSchema";
import { dateComparatorPattern, numericComparatorPattern } from "../ruleExecution";

const searchMethodValues: SearchMethod[] = ["includes-word", "includes", "starts-with", "ends-with", "domain", "full-exact", "full-text", "regex"];

const topLevelSearchableFields = new Set([
    "id",
    "title",
    "body",
    "domain",
    "url",
    "poll_option_text",
    "flair_text",
    "flair_css_class",
    "flair_template_id",
    "crosspost_title",
    "media_author",
    "media_author_url",
    "media_title",
]);

const authorSearchableFields = new Set(["id", "name", "flair_text", "flair_css_class", "display_name", "bio_text", "social_links"]);
const subredditSearchableFields = new Set(["name"]);

type MutableNode = Record<string, unknown>;
interface SearchableSource {
    rawKey: string;
    containerPath: string;
}

const searchableSourceMetadata = new WeakMap<object, SearchableSource>();

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

function toSearchableText (value: unknown, searchField: SearchableText["searchField"], options: SearchOption): SearchableText | undefined {
    const text = toStringArray(value);
    if (!text) {
        return undefined;
    }

    const searchableText: SearchableText = {
        searchField,
        text,
        options,
    };

    return searchableText;
}

function parseJsonPointer (pointer: string): string[] {
    if (!pointer) {
        return [];
    }

    return pointer
        .split("/")
        .slice(1)
        .map(segment => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function formatRuleReference (rule: MutableNode, ruleIndex: number): string {
    const friendlyName = typeof rule.friendly_name === "string" ? rule.friendly_name.trim() : "";
    return friendlyName ? `Rule '${friendlyName}'` : `Rule ${ruleIndex + 1}`;
}

function formatContainerPath (path: string): string | undefined {
    const segments = parseJsonPointer(path);
    return segments.length > 0 ? segments.join(".") : undefined;
}

function formatAttributePath (instancePath: string, suffix?: string): string | undefined {
    const segments = parseJsonPointer(instancePath);
    if (suffix) {
        segments.push(suffix);
    }

    return segments.length > 0 ? segments.join(".") : undefined;
}

function formatSchemaValidationError (error: ErrorObject, ruleReference: string): string {
    switch (error.keyword) {
        case "additionalProperties": {
            const additionalProperty = typeof error.params.additionalProperty === "string"
                ? error.params.additionalProperty
                : "unknown";
            const containerPath = formatContainerPath(error.instancePath);
            return `${ruleReference}: Unsupported attribute '${additionalProperty}'${containerPath ? ` in ${containerPath}` : ""}.`;
        }

        case "maxItems": {
            const attributePath = formatAttributePath(error.instancePath) ?? "value";
            const limit = typeof error.params.limit === "number" ? error.params.limit : undefined;
            return `${ruleReference}: Attribute '${attributePath}' must have at most ${limit ?? "the allowed number of"} item${limit === 1 ? "" : "s"}.`;
        }

        case "required": {
            const missingProperty = typeof error.params.missingProperty === "string"
                ? error.params.missingProperty
                : undefined;
            const attributePath = formatAttributePath(error.instancePath, missingProperty) ?? missingProperty ?? "value";
            return `${ruleReference}: Missing required attribute '${attributePath}'.`;
        }

        case "type": {
            const attributePath = formatAttributePath(error.instancePath) ?? "value";
            const expectedType = typeof error.params.type === "string" ? error.params.type : "the expected type";
            return `${ruleReference}: Attribute '${attributePath}' must be ${expectedType}.`;
        }

        case "enum": {
            const attributePath = formatAttributePath(error.instancePath) ?? "value";
            const allowedValues = Array.isArray(error.params.allowedValues)
                ? error.params.allowedValues.map(value => `'${String(value)}'`).join(", ")
                : undefined;
            return `${ruleReference}: Attribute '${attributePath}' must be one of ${allowedValues ?? "the allowed values"}.`;
        }

        default: {
            const attributePath = formatAttributePath(error.instancePath);
            return `${ruleReference}: ${attributePath ? `Attribute '${attributePath}' ` : ""}${error.message ?? "failed validation"}.`;
        }
    }
}

function assertValidRuleSchema (rule: MutableNode, ruleReference: string, validate: ValidateFunction): void {
    if (validate(rule)) {
        return;
    }

    const formattedErrors = (validate.errors ?? []).map(error => formatSchemaValidationError(error, ruleReference));
    const uniqueErrors = [...new Set(formattedErrors)];
    throw new Error(uniqueErrors.join(" "));
}

function defaultSearchMethodForField (fieldName: SearchField): SearchMethod {
    switch (fieldName) {
        case "id":
        case "flair_text":
        case "flair_css_class":
        case "flair_template_id":
            return "full-exact";
        case "domain":
            return "domain";
        case "url":
        case "media_author_url":
        case "social_links":
            return "includes";
        default:
            return "includes-word";
    }
}

function buildSearchOptions (fieldName: SearchField, qualifierText: string | undefined, negate: boolean): SearchOption {
    const rawParts = (qualifierText ?? "").split(",").map(part => part.trim()).filter(Boolean);
    const caseSensitive = rawParts.includes("case-sensitive") || rawParts.includes("case_sensitive");
    const parts = rawParts.filter(part => part !== "case-sensitive" && part !== "case_sensitive");

    const searchMethodCandidate = parts.length > 0 ? parts.join(", ") : undefined;
    const searchMethod = searchMethodCandidate && searchMethodValues.includes(searchMethodCandidate as SearchMethod)
        ? searchMethodCandidate as SearchMethod
        : defaultSearchMethodForField(fieldName);

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

function appendSearchableValue (node: MutableNode, fieldName: string, searchableValue: SearchableText, source: SearchableSource): void {
    const existing = node[fieldName];
    if (!Array.isArray(existing)) {
        node[fieldName] = [searchableValue];
        searchableSourceMetadata.set(searchableValue, source);
        return;
    }

    existing.push(searchableValue);
    searchableSourceMetadata.set(searchableValue, source);
}

function preprocessSearchableFields (node: MutableNode, searchableFields: Set<string>, searchConditionsFieldName: string, containerPath: string): void {
    for (const rawKey of Object.keys(node)) {
        const parsedKey = parseSearchableKey(rawKey);
        if (!parsedKey) {
            continue;
        }

        if (!parsedKey.fieldNames.every(fieldName => searchableFields.has(fieldName))) {
            continue;
        }

        const searchableValue = toSearchableText(node[rawKey], parsedKey.fieldNames as SearchableText["searchField"], buildSearchOptions(parsedKey.primaryField as SearchField, parsedKey.qualifierText, parsedKey.negate));
        if (!searchableValue) {
            continue;
        }

        // Delete decorated key versions (negation/suffix/qualifiers) and append normalized entry.
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete node[rawKey];

        appendSearchableValue(node, searchConditionsFieldName, searchableValue, {
            rawKey,
            containerPath,
        });
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

function preprocessAuthorNode (node: MutableNode, containerPath: string): void {
    preprocessSearchableFields(node, authorSearchableFields, "search_conditions", containerPath);
}

function preprocessSubredditNode (node: MutableNode, containerPath: string): void {
    preprocessSearchableFields(node, subredditSearchableFields, "search_conditions", containerPath);
}

function preprocessPostConditionLikeNode (node: MutableNode, containerPath: string): void {
    preprocessStringArrayField(node, "crosspost_id");
    preprocessSearchableFields(node, topLevelSearchableFields, "search_conditions", containerPath);

    if (isObjectRecord(node.author)) {
        preprocessAuthorNode(node.author, containerPath ? `${containerPath}.author` : "author");
    }

    if (isObjectRecord(node.subreddit)) {
        preprocessSubredditNode(node.subreddit, containerPath ? `${containerPath}.subreddit` : "subreddit");
    }

    if (isObjectRecord(node.crosspost_author)) {
        preprocessAuthorNode(node.crosspost_author, containerPath ? `${containerPath}.crosspost_author` : "crosspost_author");
    }

    if (isObjectRecord(node.crosspost_subreddit)) {
        preprocessSubredditNode(node.crosspost_subreddit, containerPath ? `${containerPath}.crosspost_subreddit` : "crosspost_subreddit");
    }
}

function validateRegexPatternsInSearchableField (node: MutableNode, fieldName: string, ruleReference: string): void {
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
        for (const pattern of textPatterns) {
            if (typeof pattern !== "string") {
                continue;
            }

            try {
                new RegExp(pattern, "u");
            } catch (error) {
                const source = searchableSourceMetadata.get(searchableItem);
                const attributeName = source?.rawKey ?? `${fieldName}[${searchableIndex}]`;
                const containerPath = source?.containerPath;
                const details = error instanceof Error ? error.message : String(error);
                throw new Error(`${ruleReference}: Invalid regex pattern for attribute '${attributeName}'${containerPath ? ` in ${containerPath}` : ""}: ${pattern} (${details})`);
            }
        }
    }
}

function validateNumericThresholdFormatInNode (node: MutableNode, ruleReference: string, numericThresholdFields: string[]): void {
    const numericThresholdRegex = new RegExp(numericComparatorPattern, "i");

    for (const fieldName of numericThresholdFields) {
        const fieldValue = node[fieldName];
        if (!fieldValue) {
            continue;
        }

        if (typeof fieldValue === "number" && Number.isInteger(fieldValue)) {
            continue;
        }

        if (typeof fieldValue !== "string" || !numericThresholdRegex.test(fieldValue)) {
            const source = searchableSourceMetadata.get(node);
            const attributeName = source?.rawKey ?? fieldName;
            const containerPath = source?.containerPath;
            throw new Error(`${ruleReference}: Invalid numeric threshold format for attribute '${attributeName}'${containerPath ? ` in ${containerPath}` : ""}`);
        }
    }
}

function validateDateThresholdFormatInNode (node: MutableNode, ruleReference: string, dateThresholdFields: string[]): void {
    const dateThresholdRegex = new RegExp(dateComparatorPattern, "i");

    for (const fieldName of dateThresholdFields) {
        const fieldValue = node[fieldName];
        if (!fieldValue) {
            continue;
        }

        if (typeof fieldValue === "number" && Number.isInteger(fieldValue)) {
            continue;
        }

        if (typeof fieldValue !== "string" || !dateThresholdRegex.test(fieldValue)) {
            const source = searchableSourceMetadata.get(node);
            const attributeName = source?.rawKey ?? fieldName;
            const containerPath = source?.containerPath;
            throw new Error(`${ruleReference}: Invalid date threshold format for attribute '${attributeName}'${containerPath ? ` in ${containerPath}` : ""}`);
        }
    }
}

function validateRegexPatternsInAuthorNode (node: MutableNode, ruleReference: string): void {
    validateRegexPatternsInSearchableField(node, "search_conditions", ruleReference);

    const numericThresholdFields = [
        "comment_karma",
        "post_karma",
        "combined_karma",
        "comment_subreddit_karma",
        "post_subreddit_karma",
        "combined_subreddit_karma",
    ];

    validateNumericThresholdFormatInNode(node, ruleReference, numericThresholdFields);

    const dateThresholdFields = [
        "account_age",
    ];

    validateDateThresholdFormatInNode(node, ruleReference, dateThresholdFields);
}

function validateRegexPatternsInSubredditNode (node: MutableNode, ruleReference: string): void {
    validateRegexPatternsInSearchableField(node, "search_conditions", ruleReference);
}

function validateRegexPatternsInPostConditionLikeNode (node: MutableNode, ruleReference: string): void {
    validateRegexPatternsInSearchableField(node, "search_conditions", ruleReference);

    if (isObjectRecord(node.author)) {
        validateRegexPatternsInAuthorNode(node.author, ruleReference);
    }

    if (isObjectRecord(node.subreddit)) {
        validateRegexPatternsInSubredditNode(node.subreddit, ruleReference);
    }

    if (isObjectRecord(node.crosspost_author)) {
        validateRegexPatternsInAuthorNode(node.crosspost_author, ruleReference);
    }

    if (isObjectRecord(node.crosspost_subreddit)) {
        validateRegexPatternsInSubredditNode(node.crosspost_subreddit, ruleReference);
    }

    if (node.poll_option_count !== undefined) {
        validateNumericThresholdFormatInNode(node, ruleReference, ["poll_option_count"]);
    }
}

export function validateRuleRegexPatterns (rule: MutableNode, ruleReference: string): void {
    validateRegexPatternsInPostConditionLikeNode(rule, ruleReference);

    if (isObjectRecord(rule.parent_submission)) {
        validateRegexPatternsInPostConditionLikeNode(rule.parent_submission, ruleReference);
    }
}

export function preprocessRule (rule: MutableNode): void {
    preprocessPostConditionLikeNode(rule, "");

    if (isObjectRecord(rule.parent_submission)) {
        preprocessPostConditionLikeNode(rule.parent_submission, "parent_submission");
    }
}

export function parseRules (rules: string): AutomodRule[] {
    if (!rules.trim()) {
        return [];
    }

    const documents = parseAllDocuments(rules, { strict: true });
    const parsedRules = _.compact(documents.map(doc => doc.toJSON() as MutableNode | null));

    for (const [index, rule] of parsedRules.entries()) {
        const ruleReference = formatRuleReference(rule, index);
        preprocessRule(rule);
        validateRuleRegexPatterns(rule, ruleReference);
    }

    const ajv = new Ajv({
        coerceTypes: "array",
    });
    const validate = ajv.compile(automodSchema);

    // Validate rules against schema one by one
    for (const [index, rule] of parsedRules.entries()) {
        assertValidRuleSchema(rule, formatRuleReference(rule, index), validate);
    }

    return parsedRules;
}
