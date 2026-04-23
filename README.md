# Campus Connect - Digital College Platform

Campus Connect is a unified digital platform designed to streamline academic and administrative tasks for students, faculty, and administrators.

## 🚀 Getting Started

To run the platform locally, follow these steps:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Access the app at [http://localhost:3000](http://localhost:3000).

3. **Run Genkit UI** (for AI features):
   ```bash
   npm run genkit:dev
   ```
   Access the AI debugger at [http://localhost:4000](http://localhost:4000).

## 🛠️ Tech Stack

### Frontend & Framework
- **Next.js 15 (App Router)**: High-performance React framework.
- **TypeScript**: Static typing for robust code.
- **Tailwind CSS**: Utility-first CSS for responsive design.
- **ShadCN UI**: High-quality accessible components built on Radix UI.
- **Lucide React**: Vector icons for clear navigation.
- **Recharts**: Data visualization for dashboards.

### Backend & Infrastructure (Firebase)
- **Firestore**: Real-time NoSQL database for assignments, attendance, and results.
- **Firebase Authentication**: Secure identity management (Email & Social).
- **Firebase Security Rules**: Granular, role-based access control (RBAC).

### Artificial Intelligence (Genkit)
- **Google Genkit**: Orchestration layer for AI operations.
- **Gemini 2.5 Flash**: Multi-modal LLM powering features like AI Feedback, Quiz Gen, and Announcement drafting.

## 🌟 Key Features
- **Real-time Attendance**: QR-code based live check-in system.
- **Academic Management**: Course materials, assignments, and automated grading loops.
- **Interactive Engagement**: Discussion forums, club memberships, and community boards.
- **Fee Management**: Individual and bulk fee assignment with status tracking.
- **AI Practice Quizzes**: Instantly generate interactive quizzes from study materials.

## 🔧 Troubleshooting

### Missing Firestore Indexes (Critical)
Firestore requires specific indexes for "Collection Group" queries used by faculty and admins to see data across all courses. If the app displays a "Database Index Required" message:
1.  **Open your browser's developer console** (Press F12).
2.  **Locate the FirebaseError** message.
3.  **Click the link** provided in the error text (e.g., https://console.firebase.google.com/...).
4.  In the Firebase Console, click **"Create Index"**. 
5.  Wait until the status is **"Active"** (approx. 2 mins).

Common collections requiring manual indexes:
- `timetables` (field `facultyId`)
- `enrollments` (field `courseId`)
- `attendance` (field `courseId`)
- `results` (field `courseId`)
- `submissions` (field `courseId`)

### Sample Credentials
To use roll numbers like `2024001` or faculty IDs like `FAC1001`, you **must** use the **Sign Up** page first and register an account using an email in the format:
- Student: `[roll_number]@student.college.edu`
- Faculty: `[faculty_id]@faculty.college.edu`
- Admin: `super.admin@college.edu`
