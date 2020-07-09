export default class Helpers {
    public static get yesterday(): Date {
        return new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    public static get maxDaysAgo(): Date {
        return new Date(Date.now() - 89 * 24 * 60 * 60 * 1000); // AppCenter API supports max 90 days ago. Do 89 to be safe.
    }

    public static getSlackLink(url: string, text: string) {
        return `<${url}|${text}>`;
    }
}