import { apps, apiToken, appUsername } from "./index";
import AsynchronousSlackBot from './AsynchronousSlackBot';
import Helpers from "./Helpers";
import AppCenterApi from "./AppCenterApi";

export default class AppCenterSlackBot extends AsynchronousSlackBot {
    private _appVersion: string | undefined;
    private _droidBuildVersion: string | undefined;
    private _iOSBuildVersion: string | undefined;


    protected get _name(): string {
        return "AppCenterBot";
    }

    protected _isEnvironmentSetup(): boolean {
        return !!(apps.iOS && apps.Android && apiToken && appUsername);
    }


    protected _parseParams(params: string[]): void {
        if (!params) {
            throw new Error("Expected command parameters, but got none.");
        }
        if (params.length === 3) {
            [this._appVersion, this._droidBuildVersion, this._iOSBuildVersion] = params;
        }
        else if (params.length === 1) {
            [this._appVersion] = params;
        }
        else {
            throw new Error(`Invalid command parameters: "${params.join(' ')}". Expected either "version" (e.g. "3.2.0"), or "version droid-build ios-build" (e.g. "3.2.0 387 3.2.0.23.0)."`);
        }
    }


    protected async _getResponse(): Promise<string> {
        const api = new AppCenterApi(apiToken as string, appUsername as string);

        if (!this._droidBuildVersion) {
            this._droidBuildVersion = await api.getLatestAppBuild(apps.Android as string, this._appVersion as string) as string;
        }
        if (!this._iOSBuildVersion) {
            this._iOSBuildVersion = await api.getLatestAppBuild(apps.iOS as string, this._appVersion as string) as string;
        }
        if (!this._droidBuildVersion || !this._iOSBuildVersion) {
            throw new Error(`Could not determine latest builds for version ${this._appVersion}. Try again, or specify them explicitly.`);
        }

        return await this._getCrashAnalytics(api, this._appVersion as string, this._droidBuildVersion, this._iOSBuildVersion);
    }


    private async _getCrashAnalytics(api: AppCenterApi, version: string, droidBuild: string, iOSBuild: string): Promise<string> {
        try {
            let result = "";

            const androidAppName = apps.Android as string;
            const clickableLinkAndroid = Helpers.getSlackLink(this._crashUrl(androidAppName, version, droidBuild), droidBuild);
            result += `Android (${clickableLinkAndroid}): ${await this._getStatsString(api, androidAppName, version, droidBuild)}\n`;

            const iOSAppName = apps.iOS as string;
            const clickableLinkiOS = Helpers.getSlackLink(this._crashUrl(iOSAppName, version, iOSBuild), iOSBuild);
            result += `iOS (${clickableLinkiOS}): ${await this._getStatsString(api, iOSAppName, version, iOSBuild)}`;

            return result;
        }
        catch (e) {
            throw new Error('I crashed due to: ' + e);
        }
    }


    private async _getStatsString(api: AppCenterApi, app: string, version: string, build: string) {
        const totalUsers = await api.getTotalUsers(app, version);
        const statsSinceLaunch = await api.getCrashCount(Helpers.maxDaysAgo, app, version, build);
        const statsSinceYesterday = await api.getCrashCount(Helpers.yesterday, app, version, build);
        const crashesSinceLaunch = statsSinceLaunch[0] + statsSinceLaunch[1];
        const crashesSinceYesterday = statsSinceYesterday[0] + statsSinceYesterday[1];

        const crashGroupsSinceLaunch = await api.getCrashGroupCount(app, version, build);

        const affectedUsers = await api.getAffectedUsers(Helpers.maxDaysAgo, app, version, build);
        const percentageAffectedUsers = ((affectedUsers / totalUsers) * 100).toFixed(1);

        return `${crashesSinceLaunch} crashes (${crashGroupsSinceLaunch} groups) affecting ${percentageAffectedUsers}% of users (${affectedUsers} of ${totalUsers}). ${crashesSinceYesterday} crashes in last 24h.`;
    }


    private _crashUrl(app: string, version: string, build: string) {
        return `https://appcenter.ms/users/${appUsername}/apps/${app}/crashes/errors?appBuild=${build}&period=last30Days&status=&version=${version}`;
    }
}
