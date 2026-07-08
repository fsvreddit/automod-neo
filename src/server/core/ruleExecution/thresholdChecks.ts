/**
 * A function to compare a number to a text input
 * @param input The numeric input
 * @param threshold The threshold to meet e.g. < 10
 * @returns True or false
 */

import { subDays, subHours, subMinutes, subMonths, subWeeks, subYears } from "date-fns";

export const numericComparatorPattern = "^(<|>|<=|>=|=)?\\s?(\\d+)$";
export const dateComparatorPattern = "^(<|>|<=|>=)?\\s?(\\d+)\\s(minute|hour|day|week|month|year)s?$";

export function meetsNumericThreshold (input: number, threshold: string): boolean {
    const regex = new RegExp(numericComparatorPattern);
    const matches = regex.exec(threshold);
    if (matches?.length !== 3) {
        return false;
    }

    const operator = matches[1];
    if (!matches[2]) {
        return false;
    }

    const value = parseInt(matches[2]);

    switch (operator) {
        case "":
        case "=":
            return input === value;
        case "<":
            return input < value;
        case "<=":
            return input <= value;
        case ">":
            return input > value;
        case ">=":
            return input >= value;
        default:
            return false;
    }
}

/**
 * A function to compare a number to a text input
 * @param input The date input
 * @param threshold The threshold to meet e.g. < 10 years
 * @param defaultOperator The operator to use if none is specified
 * @returns True or false
 */
export function meetsDateThreshold (input: Date, threshold: string, defaultOperator?: string): boolean {
    const regex = new RegExp(dateComparatorPattern);
    const matches = regex.exec(threshold);
    if (matches?.length !== 4) {
        return false;
    }

    let operator: string | undefined = matches[1];
    if (!operator && defaultOperator) {
        operator = defaultOperator;
    }
    if (!matches[2]) {
        return false;
    }

    const value = parseInt(matches[2]);
    const interval = matches[3];

    let comparisonDate: Date | undefined;
    switch (interval) {
        case "minute":
            comparisonDate = subMinutes(new Date(), value);
            break;
        case "hour":
            comparisonDate = subHours(new Date(), value);
            break;
        case "day":
            comparisonDate = subDays(new Date(), value);
            break;
        case "week":
            comparisonDate = subWeeks(new Date(), value);
            break;
        case "month":
            comparisonDate = subMonths(new Date(), value);
            break;
        case "year":
            comparisonDate = subYears(new Date(), value);
            break;
    }

    if (!comparisonDate) {
        return false;
    }

    switch (operator) {
        case "<":
            return comparisonDate < input;
        case "<=":
            return comparisonDate <= input;
        case ">":
            return comparisonDate > input;
        case ">=":
            return comparisonDate >= input;
        default:
            return false;
    }
}
