

const API_BASE = 'https://api.frame.io/v2';

// --- Type Definitions ---

interface FrameIOAsset {
    id: string;
    name: string;
    filesize: number;
    filetype: string;
    type: 'file' | 'folder' | 'version_stack';
    upload_url?: string;
    permalink_url: string;
}

export interface FrameIOProject {
    id: string;
    name: string;
}

// User object from /me
interface FrameIOUser {
    id: string;
    account_id: string;
}

// Account object with included teams
interface FrameIOAccountWithTeams {
    id: string;
    teams: { id: string }[];
}

// --- Token Management ---

const getDeveloperToken = (): string | null => localStorage.getItem('frameio_developer_token');
export const setDeveloperToken = (token: string) => localStorage.setItem('frameio_developer_token', token);
export const isFrameIOConfigured = (): boolean => getDeveloperToken() !== null;
export const disconnectFrameIO = () => localStorage.removeItem('frameio_developer_token');
export const forgetFrameIOConfig = () => localStorage.removeItem('frameio_developer_token');

// --- API Core Functions ---

const frameioFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = getDeveloperToken();
    if (!token) {
        throw new Error("Not authenticated with Frame.io. Please provide a developer token.");
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        if (response.status === 401) {
            disconnectFrameIO();
        }
        let errorMessage = `Frame.io API Error (${response.status}): ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData.errors && errorData.errors.length > 0) {
                 errorMessage = `Frame.io API Error (${response.status}): ${errorData.errors[0].title}. ${errorData.errors[0].detail}`;
            } else if (errorData.message) {
                 errorMessage = `Frame.io API Error (${response.status}): ${errorData.message}`;
            } else {
                 const textError = await response.text();
                 errorMessage = `Frame.io API Error (${response.status}): ${textError || response.statusText}`;
            }
        } catch (e) { /* Ignore parsing error */ }
        throw new Error(errorMessage);
    }
    
    if (response.status === 204) return { success: true, noContent: true };
    return response.json();
};

export const testFrameIOConnection = async (): Promise<void> => {
    await frameioFetch('/me');
};

/**
 * Gets the primary account and team ID for the authenticated user.
 * This is the core function to find the correct container for projects.
 */
const getFrameIOContext = async (): Promise<{ accountId: string, teamId: string }> => {
    const me = await frameioFetch('/me') as FrameIOUser;
    if (!me.account_id) {
        throw new Error("Could not retrieve account ID from Frame.io profile.");
    }
    
    // Explicitly include teams to ensure we get them, even on accounts with a single default team.
    const accountDetails = await frameioFetch(`/accounts/${me.account_id}?include=teams`) as FrameIOAccountWithTeams;
    
    if (!accountDetails.teams || accountDetails.teams.length === 0) {
        throw new Error("No teams found for this Frame.io account. This is required to create or list projects.");
    }
    
    // Use the first team found as the container for all projects.
    const teamId = accountDetails.teams[0].id;
    
    return { accountId: me.account_id, teamId };
};

// --- Service Functions ---

export const getFrameIOProjects = async (): Promise<FrameIOProject[]> => {
    // Projects are scoped to a team.
    const { teamId } = await getFrameIOContext();
    const projects = await frameioFetch(`/teams/${teamId}/projects`) as FrameIOProject[];
    
    projects.sort((a, b) => a.name.localeCompare(b.name));
    
    return projects;
};

export const createFrameIOProject = async (projectName: string): Promise<FrameIOProject> => {
    // Projects are created within a team.
    const { teamId } = await getFrameIOContext();
    
    const newProject = await frameioFetch(`/projects`, {
        method: 'POST',
        body: JSON.stringify({ 
            name: projectName,
            team_id: teamId 
        }),
    }) as FrameIOProject;
    
    return newProject;
};

export const uploadToFrameIO = async (
    projectId: string,
    file: Blob,
    fileName: string
): Promise<FrameIOAsset> => {
    if (!projectId) throw new Error("Frame.io Project ID is missing.");
    
    const assetData: FrameIOAsset & { upload_urls: string[] } = await frameioFetch(`/projects/${projectId}/assets`, {
        method: 'POST',
        body: JSON.stringify({ name: fileName, filesize: file.size, type: 'file' }),
    });
    
    if (!assetData.upload_urls || assetData.upload_urls.length === 0) {
        throw new Error("Frame.io did not return an upload URL.");
    }

    const uploadUrl = assetData.upload_urls[0];
    
    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'x-amz-acl': 'private' },
        body: file,
    });
    
    if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Frame.io Upload Error: ${errorText || uploadResponse.statusText}`);
    }
    
    return assetData;
};
