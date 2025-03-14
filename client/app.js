const API_URL = '/api';

const app = Vue.createApp({
    data() {
        return {
            isAuthenticated: false,
            token: null,

            currentView: 'login',

            notification: null,

            navActive: false, //mob nav


            loginForm: {
                email: '',
                password: ''
            },
            loginLoading: false,
            loginError: null,


            registerForm: {
                name: '',
                email: '',
                password: ''
            },
            registerLoading: false,
            registerError: null,


            documents: [],
            loadingDocuments: false,
            documentError: null,
            searchQuery: '',
            typeFilter: '',


            documentStats: {
                total: 0,
                valid: 0,
                expiring: 0,
                expired: 0
            },

            uploadForm: {
                name: '',
                type: '',
                expirationDate: '',
                issuingAuthority: '',
                file: null
            },
            uploadLoading: false,
            uploadError: null,

            currentDocument: null,
            loadingDocumentDetail: false,

            editForm: {
                name: '',
                type: '',
                expirationDate: '',
                issuingAuthority: '',
                file: null
            },
            editLoading: false,
            editError: null
        };
    },

    computed: {

        filteredDocuments() {
            let result = [...this.documents];

            // search filterer
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                result = result.filter(doc =>
                    doc.name.toLowerCase().includes(query) ||
                    doc.type.toLowerCase().includes(query)
                );
            }

            //type filter
            if (this.typeFilter) {
                result = result.filter(doc => doc.type === this.typeFilter);
            }

            return result;
        },


        recentDocuments() {
            return [...this.documents]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);
        },

        navState: {
            get() {
                return this.navActive;
            },
            set(value) {
                this.navActive = value;
            }
        }
    },

    created() {
        this.checkAuth();
    },

    methods: {
        toggleNavigation(forceState = null) {
            if (forceState !== null) {
                this.navActive = forceState;
            } else {
                this.navActive = !this.navActive;
            }
        },

        checkAuth() {
            const token = localStorage.getItem('token');
            if (token) {
                fetch(`${API_URL}/users/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Authentication failed');
                        }
                        return response.json();
                    })
                    .then(data => {
                        this.isAuthenticated = true;
                        this.token = token;
                        this.showDashboard();
                    })
                    .catch(error => {
                        localStorage.removeItem('token');
                        this.isAuthenticated = false;
                        this.showLogin();
                    });
            } else {
                this.showLogin();
            }
        },

        login() {
            this.loginLoading = true;
            this.loginError = null;

            fetch(`${API_URL}/users/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.loginForm)
            })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.message || 'Login failed');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    this.isAuthenticated = true;
                    this.token = data.user.id;
                    localStorage.setItem('token', this.token);

                    this.loginForm = {
                        email: '',
                        password: ''
                    };

                    this.showNotification('Login successful!', 'alert-success');
                    this.showDashboard();
                })
                .catch(error => {
                    this.loginError = error.message || 'Login failed';
                })
                .finally(() => {
                    this.loginLoading = false;
                });
        },

        register() {
            this.registerLoading = true;
            this.registerError = null;

            fetch(`${API_URL}/users/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.registerForm)
            })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.message || 'Registration failed');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    this.registerForm = {
                        name: '',
                        email: '',
                        password: ''
                    };

                    this.showNotification('Registration successful! Please log in.', 'alert-success');
                    this.showLogin();
                })
                .catch(error => {
                    this.registerError = error.message || 'Registration failed';
                })
                .finally(() => {
                    this.registerLoading = false;
                });
        },

        logout() {
            fetch(`${API_URL}/users/logout`, {
                method: 'POST'
            })
                .then(() => {
                    this.token = null;
                    localStorage.removeItem('token');
                    this.isAuthenticated = false;

                    this.showNotification('You have been logged out.', 'alert-info');
                    this.showLogin();
                })
                .catch(error => {
                    console.error('Logout error:', error);

                    this.token = null;
                    localStorage.removeItem('token');
                    this.isAuthenticated = false;
                    this.showLogin();
                });
        },

        // doc methods
        fetchDocuments() {
            this.loadingDocuments = true;
            this.documentError = null;

            fetch(`${API_URL}/documents`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 401) {
                            this.isAuthenticated = false;
                            this.showLogin();
                            throw new Error('uthentication required');
                        }
                        return response.json().then(data => {
                            throw new Error(data.message || 'error loading documents');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    this.documents = data;
                    this.calculateDocumentStats();
                })
                .catch(error => {
                    if (error.message !== 'authentication required') {
                        this.documentError = error.message || 'error loading documents';
                        console.error('error loading documents:', error);
                    }
                })
                .finally(() => {
                    this.loadingDocuments = false;
                });
        },

        calculateDocumentStats() {
            const now = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(now.getDate() + 30);

            let valid = 0;
            let expiring = 0;
            let expired = 0;

            this.documents.forEach(doc => {
                if (!doc.expirationDate) {
                    valid++;
                    return;
                }

                const expiryDate = new Date(doc.expirationDate);

                if (expiryDate < now) {
                    expired++;
                } else if (expiryDate <= thirtyDaysFromNow) {
                    expiring++;
                } else {
                    valid++;
                }
            });

            this.documentStats = {
                total: this.documents.length,
                valid,
                expiring,
                expired
            };
        },

        uploadDocument() {
            if (!this.isValidFile()) {
                this.uploadError = 'Please upload a valid file';
                return;
            }

            this.uploadLoading = true;
            this.uploadError = null;

            const formData = new FormData();
            formData.append('name', this.uploadForm.name);
            formData.append('type', this.uploadForm.type);

            if (this.uploadForm.expirationDate) {
                formData.append('expirationDate', this.uploadForm.expirationDate);
            }

            if (this.uploadForm.issuingAuthority) {
                formData.append('issuingauthority', this.uploadForm.issuingAuthority);
            }

            formData.append('file', this.uploadForm.file);

            fetch(`${API_URL}/documents`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 401) {
                            this.isAuthenticated = false;
                            this.showLogin();
                            throw new Error('athentication required');
                        }
                        return response.json().then(data => {
                            throw new Error(data.message || 'upload failed');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    this.documents.unshift(data);

                    //reset form
                    this.uploadForm = {
                        name: '',
                        type: '',
                        expirationDate: '',
                        issuingAuthority: '',
                        file: null
                    };


                    this.calculateDocumentStats();

                    this.showNotification('Document uploaded successfully!', 'alert-success');
                    this.showDocuments();
                })
                .catch(error => {
                    if (error.message !== 'authentication required') {
                        console.error('upload error:', error);
                        this.uploadError = error.message || 'upload failed';
                    }
                })
                .finally(() => {
                    this.uploadLoading = false;
                });
        },

        viewDocument(documentId) {
            this.currentView = 'documentDetail';
            this.loadingDocumentDetail = true;
            this.documentError = null;

            fetch(`${API_URL}/documents/${documentId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 401) {
                            this.isAuthenticated = false;
                            this.showLogin();
                            throw new Error('Authentication required');
                        }
                        return response.json().then(data => {
                            throw new Error(data.message || 'error loading document');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    this.currentDocument = data;
                })
                .catch(error => {
                    if (error.message !== 'authentication required') {
                        console.error('error loading document:', error);
                        this.documentError = error.message || 'error loading document';
                    }
                })
                .finally(() => {
                    this.loadingDocumentDetail = false;
                });
        },

        prepareEditForm() {
            this.editForm = {
                name: this.currentDocument.name,
                type: this.currentDocument.type,
                expirationDate: this.currentDocument.expirationDate ? this.formatDateForInput(this.currentDocument.expirationDate) : '',
                issuingAuthority: this.currentDocument.issuingAuthority || '',
                file: null
            };
            this.currentView = 'editDocument';
        },

        editDocument(documentId) {
            if (!this.currentDocument || this.currentDocument._id !== documentId) {
                this.viewDocument(documentId);
                setTimeout(() => {
                    this.prepareEditForm();
                }, 600);
            } else {
                this.prepareEditForm();
            }
        },

        updateDocument() {
            this.editLoading = true;
            this.editError = null;

            const formData = new FormData();
            formData.append('name', this.editForm.name);
            formData.append('type', this.editForm.type);

            if (this.editForm.expirationDate) {
                formData.append('expirationDate', this.editForm.expirationDate);
            }

            if (this.editForm.issuingAuthority) {
                formData.append('issuingAuthority', this.editForm.issuingAuthority);
            }

            if (this.editForm.file) {
                formData.append('file', this.editForm.file);
            }

            fetch(`${API_URL}/documents/${this.currentDocument._id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 401) {
                            this.isAuthenticated = false;
                            this.showLogin();
                            throw new Error('Authentication required');
                        }
                        return response.json().then(data => {
                            throw new Error(data.message || 'Update failed');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    const index = this.documents.findIndex(doc => doc._id === this.currentDocument._id);
                    if (index !== -1) {
                        this.documents[index] = data;
                    }
                    this.currentDocument = data;

                    this.calculateDocumentStats();

                    this.showNotification('Document updated successfully!', 'alert-success');
                    this.viewDocument(this.currentDocument._id);
                })
                .catch(error => {
                    if (error.message !== 'Authentication required') {
                        console.error('Update error:', error);
                        this.editError = error.message || 'Update failed';
                    }
                })
                .finally(() => {
                    this.editLoading = false;
                });
        },

        confirmDelete(document) {
            if (confirm(`Are you sure you want to delete "${document.name}"?`)) {
                this.deleteDocument(document._id);
            }
        },

        deleteDocument(documentId) {
            fetch(`${API_URL}/documents/${documentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 401) {
                            this.isAuthenticated = false;
                            this.showLogin();
                            throw new Error('Authentication required');
                        }
                        return response.json().then(data => {
                            throw new Error(data.message || 'Delete failed');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    //remove doc from array
                    this.documents = this.documents.filter(doc => doc._id !== documentId);

                    this.calculateDocumentStats();

                    this.showNotification('Document deleted successfully!', 'alert-success');
                    if (this.currentView === 'documentDetail' || this.currentView === 'editDocument') {
                        this.showDocuments();
                    }
                })
                .catch(error => {
                    if (error.message !== 'Authentication required') {
                        this.showNotification(error.message || 'Delete failed', 'alert-danger');
                    }
                });
        },

        //ui stuff
        showLogin() {
            this.currentView = 'login';
            this.loginError = null;
            this.navActive = false;
        },

        showRegister() {
            this.currentView = 'register';
            this.registerError = null;
            this.navActive = false;
        },

        showDashboard() {
            if (!this.isAuthenticated) {
                this.showLogin();
                return;
            }

            this.currentView = 'dashboard';
            this.fetchDocuments();
            this.navActive = false;
        },

        showDocuments() {
            if (!this.isAuthenticated) {
                this.showLogin();
                return;
            }

            this.currentView = 'documents';
            this.fetchDocuments();
            this.navActive = false;
        },

        showUpload() {
            if (!this.isAuthenticated) {
                this.showLogin();
                return;
            }

            this.currentView = 'upload';
            this.uploadError = null;
            this.uploadForm = {
                name: '',
                type: '',
                expirationDate: '',
                issuingAuthority: '',
                file: null
            };
            this.navActive = false;
        },


        handleFileSelect(event) {
            const file = event.target.files[0];
            if (this.currentView === 'upload') {
                this.uploadForm.file = file;
            } else if (this.currentView === 'editDocument') {
                this.editForm.file = file;
            }
        },

        getFileType(file) {
            if (!file) return 'other';

            if (file.type === 'application/pdf') {
                return 'pdf';
            } else if (file.type.startsWith('image/')) {
                return 'image';
            } else {
                return 'other';
            }
        },

        isValidFileType(file) {
            const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            return file && validTypes.includes(file.type);
        },

        isValidFileSize(file) {
            const maxSize = 5 * 1024 * 1024; // 5mb for the docs
            return file && file.size <= maxSize;
        },

        isValidFile() {
            const file = this.uploadForm.file;
            if (!file) return false;
            return this.isValidFileType(file) && this.isValidFileSize(file);
        },

        getStatusIcon(document) {
            const status = this.getDocumentStatus(document);
            return {
                'valid': 'check-circle',
                'expiring': 'exclamation-circle',
                'expired': 'times-circle'
            }[status];
        },

        // utility stuff
        formatDate(dateString) {
            if (!dateString) return null;

            const date = new Date(dateString);
            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        },

        formatDateForInput(dateString) {
            if (!dateString) return '';

            const date = new Date(dateString);
            return date.toISOString().split('T')[0];
        },

        getStatusClass(document) {
            const status = this.getDocumentStatus(document);
            return {
                'valid': 'badge-valid',
                'expiring': 'badge-expiring',
                'expired': 'badge-expired'
            }[status];
        },

        getStatusText(document) {
            const status = this.getDocumentStatus(document);
            return {
                'valid': 'Valid',
                'expiring': 'Expiring Soon',
                'expired': 'Expired'
            }[status];
        },

        getDocumentStatus(document) {
            if (!document.expirationDate) return 'valid';

            const now = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(now.getDate() + 30);
            const expiryDate = new Date(document.expirationDate);

            if (expiryDate < now) {
                return 'expired';
            } else if (expiryDate <= thirtyDaysFromNow) {
                return 'expiring';
            } else {
                return 'valid';
            }
        },

        showNotification(message, type = 'alert-info') {
            this.notification = { message, type };
            setTimeout(() => {
                this.clearNotification();
            }, 5000);
        },

        clearNotification() {
            this.notification = null;
        }
    }
});


app.mount('#app');