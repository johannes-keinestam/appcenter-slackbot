import { Request, Response } from "express";
const request = require('request-promise-native');

export default abstract class AsynchronousSlackBot {
    public async onSlashCommand(req: Request, res: Response): Promise<any> {
        if (!this._isEnvironmentSetup()) {
            return res.send(`${this._name} is not properly set up. Make sure that all environment variables have been set on the host.`);
        }
        if (!req.body || !req.body['response_url']) {
            return res.send('No callback URL');
        }

        const params = req.body.text ? req.body.text.split(' ') : null;

        try {
            this._parseParams(params);
        }
        catch (validationError) {
            return res.send(validationError.message);
        }

        res.json({
            response_type: 'in_channel',
            text: 'Fetching data...',
        });

        let response = '';
        try {
            response = await this._getResponse();
        }
        catch (processingError) {
            return res.send(processingError.message);
        }

        const requestOptions = {
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                response_type: 'in_channel',
                text: response,
            }),
        };
        await request.post(req.body['response_url'], requestOptions);
    }


    protected abstract _getResponse(): Promise<string>;
    protected abstract get _name(): string;
    protected abstract _isEnvironmentSetup(): boolean;
    protected abstract _parseParams(params: string[]): void;
}
