/**
 * Third-Party Integrations Module
 * Handles Google Sheets, GitHub, Slack, Notion, HubSpot, Jira, and Mapbox integrations
 */

/**
 * Google Sheets Integration
 */
export interface GoogleSheetsConfig {
  spreadsheetId: string;
  range: string;
  apiKey?: string;
}

export interface GoogleSheetsRow {
  [key: string]: string | number | boolean;
}

export class GoogleSheetsClient {
  private apiKey: string;
  private baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_SHEETS_API_KEY || '';
    if (!this.apiKey) throw new Error('Google Sheets API key not configured');
  }

  async readSheet(spreadsheetId: string, range: string): Promise<GoogleSheetsRow[]> {
    const response = await fetch(
      `${this.baseUrl}/${spreadsheetId}/values/${range}?key=${this.apiKey}`
    );

    if (!response.ok) throw new Error(`Google Sheets error: ${response.statusText}`);

    const data = await response.json();
    const headers = data.values[0];
    const rows = data.values.slice(1);

    return rows.map((row: any[]) => {
      const obj: GoogleSheetsRow = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  }

  async appendRow(
    spreadsheetId: string,
    range: string,
    values: (string | number | boolean)[]
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/${spreadsheetId}/values/${range}:append?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values: [values],
          valueInputOption: 'USER_ENTERED',
        }),
      }
    );

    if (!response.ok) throw new Error(`Google Sheets error: ${response.statusText}`);
  }
}

/**
 * GitHub Integration
 */
export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  stars: number;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export class GitHubClient {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN || '';
    if (!this.token) throw new Error('GitHub token not configured');
  }

  async getRepositories(username: string): Promise<GitHubRepo[]> {
    const response = await fetch(`${this.baseUrl}/users/${username}/repos`, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) throw new Error(`GitHub error: ${response.statusText}`);

    const data = await response.json();
    return data.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
    }));
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string
  ): Promise<GitHubIssue> {
    const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body }),
    });

    if (!response.ok) throw new Error(`GitHub error: ${response.statusText}`);

    const data = await response.json();
    return {
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

/**
 * Slack Integration
 */
export interface SlackMessage {
  channel: string;
  text: string;
  threadTs?: string;
}

export class SlackClient {
  private token: string;
  private baseUrl = 'https://slack.com/api';

  constructor(token?: string) {
    this.token = token || process.env.SLACK_BOT_TOKEN || '';
    if (!this.token) throw new Error('Slack bot token not configured');
  }

  async sendMessage(channel: string, text: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text }),
    });

    if (!response.ok) throw new Error(`Slack error: ${response.statusText}`);
  }

  async sendThreadMessage(channel: string, threadTs: string, text: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, thread_ts: threadTs, text }),
    });

    if (!response.ok) throw new Error(`Slack error: ${response.statusText}`);
  }
}

/**
 * Notion Integration
 */
export interface NotionPage {
  id: string;
  title: string;
  properties: Record<string, any>;
  createdTime: Date;
  lastEditedTime: Date;
}

export class NotionClient {
  private token: string;
  private baseUrl = 'https://api.notion.com/v1';

  constructor(token?: string) {
    this.token = token || process.env.NOTION_API_KEY || '';
    if (!this.token) throw new Error('Notion API key not configured');
  }

  async queryDatabase(databaseId: string, filter?: any): Promise<NotionPage[]> {
    const response = await fetch(`${this.baseUrl}/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filter }),
    });

    if (!response.ok) throw new Error(`Notion error: ${response.statusText}`);

    const data = await response.json();
    return data.results.map((page: any) => ({
      id: page.id,
      title: page.properties.Name?.title[0]?.plain_text || 'Untitled',
      properties: page.properties,
      createdTime: new Date(page.created_time),
      lastEditedTime: new Date(page.last_edited_time),
    }));
  }

  async createPage(databaseId: string, properties: Record<string, any>): Promise<NotionPage> {
    const response = await fetch(`${this.baseUrl}/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
    });

    if (!response.ok) throw new Error(`Notion error: ${response.statusText}`);

    const data = await response.json();
    return {
      id: data.id,
      title: properties.Name?.title[0]?.plain_text || 'Untitled',
      properties: data.properties,
      createdTime: new Date(data.created_time),
      lastEditedTime: new Date(data.last_edited_time),
    };
  }
}

/**
 * Mapbox Integration
 */
export interface MapboxLocation {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface MapboxRoute {
  distance: number;
  duration: number;
  geometry: any;
}

export class MapboxClient {
  private token: string;
  private baseUrl = 'https://api.mapbox.com';

  constructor(token?: string) {
    this.token = token || process.env.MAPBOX_API_KEY || '';
    if (!this.token) throw new Error('Mapbox API key not configured');
  }

  async geocode(query: string): Promise<MapboxLocation[]> {
    const response = await fetch(
      `${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${this.token}`
    );

    if (!response.ok) throw new Error(`Mapbox error: ${response.statusText}`);

    const data = await response.json();
    return data.features.map((feature: any) => ({
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      name: feature.place_name,
    }));
  }

  async getRoute(
    from: MapboxLocation,
    to: MapboxLocation,
    profile: 'driving' | 'walking' | 'cycling' = 'driving'
  ): Promise<MapboxRoute> {
    const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    const response = await fetch(
      `${this.baseUrl}/directions/v5/mapbox/${profile}/${coordinates}?access_token=${this.token}`
    );

    if (!response.ok) throw new Error(`Mapbox error: ${response.statusText}`);

    const data = await response.json();
    const route = data.routes[0];
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
    };
  }
}

/**
 * Twilio Integration (SMS/Voice)
 */
export class TwilioClient {
  private accountSid: string;
  private authToken: string;
  private baseUrl = 'https://api.twilio.com/2010-04-01';

  constructor(accountSid?: string, authToken?: string) {
    this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || '';
    if (!this.accountSid || !this.authToken) throw new Error('Twilio credentials not configured');
  }

  async sendSMS(to: string, message: string, from?: string): Promise<void> {
    const fromNumber = from || process.env.TWILIO_PHONE_NUMBER || '';
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/Accounts/${this.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: message,
      }).toString(),
    });

    if (!response.ok) throw new Error(`Twilio error: ${response.statusText}`);
  }
}

/**
 * SendGrid Integration (Email)
 */
export class SendGridClient {
  private apiKey: string;
  private baseUrl = 'https://api.sendgrid.com/v3';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SENDGRID_API_KEY || '';
    if (!this.apiKey) throw new Error('SendGrid API key not configured');
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    from?: string
  ): Promise<void> {
    const fromEmail = from || process.env.SENDGRID_FROM_EMAIL || 'noreply@geminios.app';

    const response = await fetch(`${this.baseUrl}/mail/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) throw new Error(`SendGrid error: ${response.statusText}`);
  }
}
