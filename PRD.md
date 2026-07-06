# Project Requirements Document

*This is the original PRD written at the start of the Bucket project and is kept for
historical context. For current project documentation, see [README.md](README.md) and
the [docs/](docs/) directory.*

## 1. Project Overview

- **Project Name:** Bucket
- **Description:** A desktop application built with Tauri that helps users manage video editing projects, including file selection, project creation, and integration with external tools like Adobe Premiere.
- **Target Audience:** Video editors, filmmakers, and content creators.

## 2. Objectives

### File Management:

- Allow users to select folders and files for their video projects.
- Provide a mechanism to assign cameras to specific files.
- Enable deletion of unwanted files from the project list.

### Project Creation:

- Allow users to create new projects with customizable titles and camera configurations.
- Generate necessary project files and folder structures automatically.
- Integrate with Adobe Premiere for template creation and project setup.

### User Authentication:

- Implement login and registration functionality for user accounts.
- Store and manage user data securely.

### Progress Tracking:

- Display progress bars during file operations (e.g., copying files).
- Provide real-time updates on the status of project creation.

### Utilities:

- Include various utility components and functions to enhance user experience, such as date formatting, external links, and API key management.

## 3. Features

### File Selection and Management

- **Folder Tree:** Users can browse and select folders for their projects.
- **File List:** Display a list of selected files with camera assignment options.
- **Delete Functionality:** Allow users to remove files from the project list.

### Project Configuration

- **Title Input:** Enter a title for the project.
- **Camera Selection:** Specify the number of cameras and assign them to files.
- **Folder Selection:** Choose a parent folder for the project.

### Project Creation Workflow

- **Create Project Button:** Initiates the process of creating a new project.
- **Progress Bar:** Displays the progress of file operations.
- **Success/Failure Messages:** Inform users about the status of project creation.

### User Authentication

- **Login and Register Pages:** Allow users to create and log in to their accounts.
- **Secure Data Storage:** Store user data securely using useBreadcrumbStore and other utilities.

### Utilities

- **API Key Input:** Provide an interface for entering API keys.
- **Debounce Function:** Utilize debounce logic for input fields.
- **Formatted Date Component:** Display dates in a formatted manner.
- **External Links:** Include components for linking to external resources.
- **Trello Integration:** Integrate with Trello for project management features.
- **Sprout Video Upload:** Handles uploading of video content to sproutvideo.com.
- **Posterframe Generation:** Handles the creation of posterframe images that can be used as a thumbnail in Sprout Video uploads.

## 4. User Stories

- As a user, I want to select a folder for my project so that I can manage my files within the application.
- As a user, I want to assign cameras to specific files so that I can organize my footage efficiently.
- As a user, I want to delete unwanted files from my project list so that I can maintain a clean and organized project structure.
- As a user, I want to create a new project with a custom title and camera configuration so that I can start editing right away.
- As a user, I want to see progress updates during file operations so that I know when my project is ready.
- As a user, I want to log in to my account so that I can access my projects and settings.
- As a user, I want to register for an account so that I can start using the application without any hassle.
- As a user, I want to select a Trello card and add the breadcrumbs.json file i've just created to the card description.
- As a user, I want upload my video content to Sprout Video for hosting.
- As a user, I want to generate custom posterframes that can be added to my videos on Sprout Video.

## 5. Technical Requirements

### Frontend:

- **Framework:** React
- **Language:** Typescript
- **Components:**
  - BuildProject: Handles project creation and file management.
  - FolderTree: Displays a tree view of folders for selection.
  - FileItem: Represents individual files with camera assignment options.
  - Authentication components (Login.tsx, Register.tsx).
  - Utility components (e.g., ApiKeyInput.tsx, FormattedDate.tsx).
  - UploadSprout: Handles uploading of video content to sproutvideo.com.
  - UploadTrello: Handles editing of card descriptions on a board for project management.
  - Posterframe: Handles the creation of posterframe images that can be used as a thumbnail in Sprout Video uploads

### Backend:

- **Framework:** Tauri
- **Language:** Rust
- **Functions:**
  - File operations (e.g., copying files with progress updates in main.rs).
  - Command invocation and data handling using Tauri's IPC system.

### Integration:

- **Adobe Premiere Integration:** Project template creation.
- **Trello Integration:** Project management features. Add video info to cards
- **Sprout Video Integration:** Upload rendered footage to online video host and create posterframe/thumbnail images

## 6. Non-Functional Requirements

- **Performance:** Ensure smooth file operations and project creation workflows with real-time progress updates.
- **Security:** Securely store user data and API keys using appropriate encryption methods.
- **Usability:** Design intuitive interfaces for easy navigation and usage.
- **Compatibility:** Support multiple operating systems (Windows, macOS, Linux) via Tauri.

## 7. Dependencies

### Frontend:

- React
- ShadCN
- Tailwind CSS
- Lucide Icons (Trash2 icon)
- Other UI libraries as needed

### Backend:

- Rust
- Tauri
- Necessary crates for file operations, IPC, and other functionalities

## 8. Technical Requirements and Best Practices

### Frontend Coding Standards:

- Use TanStack React Query instead of useEffect where possible to make the code cleaner and easier to maintain.

### Code Snippets:

- **BuildProject.tsx:** Handles project creation and file management.
- **main.rs:** Contains the function for copying files with progress updates.

---

**Conclusion**
This PRD outlines the key features, user stories, and technical requirements for Bucket. It serves as a blueprint for development and ensures that all stakeholders have a clear understanding of the project goals and functionalities.

If you need more detailed information on specific components or functions, you can refer to the following files:

- src/pages/BuildProject.tsx
- src-tauri/src/main.rs
- src/components/auth/Login.tsx
- src/components/auth/Register.tsx
- src/components/store/useAppStore.ts
- src/components/store/useBreadcrumbStore.ts
- src/components/utils/ (various utility files)

For more detailed technical specifications or additional features, you might need to consult the Tauri documentation and relevant Rust libraries.
