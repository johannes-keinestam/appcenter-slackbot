import Helpers from "./Helpers";
const versionCompare = require("node-version-compare");
const request = require('request-promise-native');

export default class AppCenterApi {
    private readonly _baseUrl = `https://appcenter.ms/api/v0.1`;
    private readonly _apiToken: string;
    private readonly _username: string;

    public constructor(apiToken: string, username: string) {
        this._apiToken = apiToken;
        this._username = username;
    }

    public async getLatestAppBuild(app: string, version: string): Promise<string | null> {
        const url = `${this._apiUrl(app)}/errors/availableAppBuilds?version=${version}`;
        const response = JSON.parse(await request.get(url, this._requestOptions));

        const appBuilds = response['app_builds'].sort(versionCompare).reverse();
        return appBuilds.length > 0 ? appBuilds[0] : null;
    }

    public async getAffectedUsers(launchDate: Date, app: string, version: string, build: string): Promise<number> {
        const url = `${this._apiUrl(app)}/errors/errorGroups?version=${version}&app_build=${build}&start=${encodeURIComponent(launchDate.toISOString())}&errorType=all&$orderby=devices%20desc&$top=30`;
        const response = JSON.parse(await request.get(url, this._requestOptions));

        let affectedUsers = 0;
        for (const errorGroup of response.errorGroups) {
            affectedUsers += errorGroup.deviceCount;
        }
        return affectedUsers;
    }

    public async getCrashCount(sinceDate: Date, app: string, version: string, build: string): Promise<[number, number]> {
        const url = `${this._apiUrl(app)}/errors/errorCountsPerDay?version=${version}&app_build=${build}&start=${encodeURIComponent(sinceDate.toISOString())}`;

        const crashInfo = await request.get(url + '&errorType=unhandlederror', this._requestOptions);
        const errorInfo = await request.get(url + '&errorType=handlederror', this._requestOptions);

        const crashCount = JSON.parse(crashInfo).count;
        const errorCount = JSON.parse(errorInfo).count;

        return [crashCount, errorCount];
    }

    public async getTotalUsers(app: string, version: string): Promise<number> {
        const url = `${this._apiUrl(app)}/analytics/versions/?start=${encodeURIComponent(Helpers.yesterday.toISOString())}&versions=${version}`;
        const response = JSON.parse(await request.get(url, this._requestOptions));
        return response.total;
    }

    public async getCrashGroupCount(app: string, version: string, build: string): Promise<number> {
        let crashGroups: object[] = [];
        let url = `${this._apiUrl(app)}/errors/errorGroups?version=${version}&app_build=${build}&start=${encodeURIComponent(Helpers.maxDaysAgo.toISOString())}`;
        while (true) {
            const response = JSON.parse(await request.get(url, this._requestOptions));
            crashGroups = crashGroups.concat(response.errorGroups);

            // Handle paginated results
            if (response.nextLink) {
                // If the URL is relative, prefix it with the AppCenter domain.
                url = response.nextLink.startsWith("http") ? response.nextLink : "https://appcenter.ms" + response.nextLink;
            } else {
                break;
            }
        }
        return crashGroups.length;
    }

    private _apiUrl(app: string) {
        return `${this._baseUrl}/apps/${this._username}/${app}`;
    }

    private get _requestOptions() {
        return {
            headers: {
                'content-type': 'application/json',
                'x-api-token': this._apiToken,
            }
        };
    }
}