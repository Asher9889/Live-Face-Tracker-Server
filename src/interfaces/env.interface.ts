interface IEnv {
    port: number;
    nodeEnv: string;
    mongoUser: string;
    mongoPassword: string;
    mongoHost: string;
    mongoPort: string;
    mongoAuthSource: string;
    mongoDBUrl?: string;
    dbName: string;
    accessSecret: string;
    refreshSecret: string;
    gmailWebMailHost: string;
    gmailWebMailPort:number;
    gmailWebMailUser:string;
    gmailWebMailPass: string
    clientEmail: string;
    enquiryN8NWebhookUrl: string;
}


export { type IEnv }
