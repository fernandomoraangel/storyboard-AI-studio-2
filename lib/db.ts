import type { StoryboardStyle, Scene, Character, Reference, ProjectMeta, CustomStyle, Episode, ProjectState } from '../types';

// Re-export ProjectState from types to ensure consistency across the app
export type { ProjectState };

// Define the shape of the project object stored in the DB.
export interface Project {
  id?: number;
  name: string;
  modified: Date;
  state: ProjectState;
}

const DB_NAME = 'StoryboardAIStudioDB';
const DB_VERSION = 3; // Version incremented for custom styles store
const PROJECTS_STORE_NAME = 'projects';
const STYLES_STORE_NAME = 'customStyles';

let db: IDBDatabase;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('IndexedDB error');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (event.oldVersion < 2) {
          if (dbInstance.objectStoreNames.contains('projectState')) {
              dbInstance.deleteObjectStore('projectState');
          }
      }
      if (!dbInstance.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
        const store = dbInstance.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('modified', 'modified', { unique: false });
      }
      if (event.oldVersion < 3) {
        if (!dbInstance.objectStoreNames.contains(STYLES_STORE_NAME)) {
            dbInstance.createObjectStore(STYLES_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      }
    };
  });
};

export const saveProject = async (project: Omit<Project, 'modified'>): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE_NAME);
    const projectToSave: Project = { ...project, modified: new Date() };

    let request: IDBRequest;

    if (projectToSave.id != null) {
      request = store.put(projectToSave);
    } else {
      delete projectToSave.id;
      request = store.add(projectToSave);
    }

    request.onsuccess = () => {
      resolve(request.result as number);
    };
    request.onerror = () => {
      console.error('Error saving project:', request.error);
      reject(request.error);
    };
  });
};

export const getProjectsList = async (): Promise<ProjectMeta[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(PROJECTS_STORE_NAME);
    const index = store.index('modified');
    const request = index.openCursor(null, 'prev');
    
    const projectsMeta: ProjectMeta[] = [];

    request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
            const { id, name, modified } = cursor.value;
            if (id !== undefined) {
                projectsMeta.push({ id, name, modified });
            }
            cursor.continue();
        } else {
            resolve(projectsMeta);
        }
    };
    request.onerror = () => {
      console.error('Error getting project list:', request.error);
      reject(request.error);
    };
  });
};

export const getProject = async (id: number): Promise<Project | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(PROJECTS_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      console.error('Error getting project:', request.error);
      reject(request.error);
    };
  });
};

export const deleteProject = async (id: number): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.error('Error deleting project:', request.error);
      reject(request.error);
    };
  });
};

export const saveCustomStyle = async (style: Omit<CustomStyle, 'id'>): Promise<number> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STYLES_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STYLES_STORE_NAME);
        const request = store.add(style);
        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => {
            console.error('Error saving custom style:', request.error);
            reject(request.error);
        }
    });
};

export const getCustomStyles = async (): Promise<CustomStyle[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STYLES_STORE_NAME, 'readonly');
        const store = transaction.objectStore(STYLES_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            console.error('Error getting custom styles:', request.error);
            reject(request.error);
        }
    });
};

export const deleteCustomStyle = async (id: number): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STYLES_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STYLES_STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Error deleting custom style:', request.error);
            reject(request.error);
        }
    });
};