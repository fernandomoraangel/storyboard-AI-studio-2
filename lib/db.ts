
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
const DB_VERSION = 5; // Increment to ensure schema updates
const PROJECTS_STORE_NAME = 'projects';
const STYLES_STORE_NAME = 'customStyles';

let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    // Safety timeout
    const timeout = setTimeout(() => {
        reject(new Error("Database connection timed out. Please reload the page."));
    }, 3000);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      clearTimeout(timeout);
      console.error('IndexedDB error:', request.error);
      reject(request.error || new Error("Failed to open database"));
    };

    request.onblocked = () => {
        console.warn("Database upgrade blocked. Please close other tabs of this app.");
    };

    request.onsuccess = () => {
      clearTimeout(timeout);
      db = request.result;
      
      // Handle generic error handling for the db connection
      db.onversionchange = () => {
          db?.close();
          db = null;
          alert("A new version of this app is available. Please reload.");
      };
      
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;

      // Clean up old stores if necessary (from v1/v2)
      if (event.oldVersion < 2) {
          if (dbInstance.objectStoreNames.contains('projectState')) {
              dbInstance.deleteObjectStore('projectState');
          }
      }

      // Ensure PROJECTS store exists
      let projectsStore: IDBObjectStore;
      if (!dbInstance.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
        projectsStore = dbInstance.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      } else {
        projectsStore = transaction!.objectStore(PROJECTS_STORE_NAME);
      }

      // Ensure 'modified' index exists on PROJECTS store
      if (!projectsStore.indexNames.contains('modified')) {
          projectsStore.createIndex('modified', 'modified', { unique: false });
      }

      // Ensure STYLES store exists
      if (!dbInstance.objectStoreNames.contains(STYLES_STORE_NAME)) {
          dbInstance.createObjectStore(STYLES_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const saveProject = async (project: Omit<Project, 'modified'>): Promise<number> => {
  try {
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
  } catch (e) {
      console.error("DB Save failed:", e);
      throw e;
  }
};

export const getProjectsList = async (): Promise<ProjectMeta[]> => {
  try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECTS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(PROJECTS_STORE_NAME);
        
        const projectsMeta: ProjectMeta[] = [];
        
        // Use index if available
        if (store.indexNames.contains('modified')) {
            const index = store.index('modified');
            const request = index.openCursor(null, 'prev');
    
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
            request.onerror = () => reject(request.error);
        } else {
            // Fallback
            const request = store.getAll();
            request.onsuccess = () => {
                const projects = request.result as Project[];
                const metas = projects.map(p => ({ id: p.id!, name: p.name, modified: p.modified }))
                                      .sort((a, b) => b.modified.getTime() - a.modified.getTime());
                resolve(metas);
            };
            request.onerror = () => reject(request.error);
        }
      });
  } catch (e) {
      console.error("DB List failed:", e);
      return [];
  }
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
