/**
 * Storage and Project Management Module
 */
const CA_Storage = {
    projects: [],
    activeProjectId: null,

    init() {
        const savedProjects = localStorage.getItem('caWayspotProjects');
        const savedActiveId = localStorage.getItem('caWayspotActiveProjectId');
        const oldData = localStorage.getItem('pokemonMapSavedData');

        if (savedProjects) {
            this.projects = JSON.parse(savedProjects);
            this.activeProjectId = savedActiveId || (this.projects.length > 0 ? this.projects[0].id : null);
        } else if (oldData) {
            const parsedOldData = JSON.parse(oldData);
            const defaultId = crypto.randomUUID();
            this.projects = [{
                id: defaultId,
                name: "โปรเจกต์เริ่มต้น",
                data: parsedOldData
            }];
            this.activeProjectId = defaultId;
            this.saveAll();
        } else {
            const defaultId = crypto.randomUUID();
            this.projects = [{
                id: defaultId,
                name: "โปรเจกต์เริ่มต้น",
                data: []
            }];
            this.activeProjectId = defaultId;
            this.saveAll();
        }
    },

    saveAll() {
        localStorage.setItem('caWayspotProjects', JSON.stringify(this.projects));
        localStorage.setItem('caWayspotActiveProjectId', this.activeProjectId);
    },

    getActiveProject() {
        return this.projects.find(p => p.id === this.activeProjectId);
    },

    updateActiveProjectData(data) {
        const pIndex = this.projects.findIndex(p => p.id === this.activeProjectId);
        if (pIndex !== -1) {
            this.projects[pIndex].data = data;
            this.saveAll();
        }
    },

    createNewProject(name) {
        const newId = crypto.randomUUID();
        this.projects.push({
            id: newId,
            name: name,
            data: []
        });
        this.saveAll();
        return newId;
    },

    duplicateProject(id, suffix) {
        const project = this.projects.find(p => p.id === id);
        if (project) {
            const newId = crypto.randomUUID();
            const newProject = {
                id: newId,
                name: project.name + suffix,
                data: JSON.parse(JSON.stringify(project.data))
            };
            this.projects.push(newProject);
            this.saveAll();
            return newId;
        }
        return null;
    },

    renameProject(id, newName) {
        const project = this.projects.find(p => p.id === id);
        if (project) {
            project.name = newName;
            this.saveAll();
        }
    },

    deleteProject(id) {
        if (this.projects.length <= 1) return false;
        this.projects = this.projects.filter(p => p.id !== id);
        if (this.activeProjectId === id) {
            this.activeProjectId = this.projects[0].id;
        }
        this.saveAll();
        return true;
    }
};
