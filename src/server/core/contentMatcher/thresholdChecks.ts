export function isValueWithinThreshold (value: number, threshold: string): boolean {
    const regex = /^([<>])?\s?(\d+)$/;
    const match = regex.exec(threshold.trim());
    if (!match || match.length < 3) {
        return false;
    }

    const operator = match[1];
    const thresholdText = match[2];

    if (!thresholdText) {
        return false;
    }

    const thresholdValue = parseInt(thresholdText, 10);

    switch (operator) {
        case ">":
            return value > thresholdValue;
        case "<":
            return value < thresholdValue;
        default:
            return value === thresholdValue;
    }
}
