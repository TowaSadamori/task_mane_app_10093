import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  serverTimestamp,
  DocumentData,
  DocumentReference,
  CollectionReference,
  Timestamp,
  updateDoc,
  deleteDoc,
  // query,
  // orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';


export interface Project {
  id: string;
  name: string;
  description: string;
  startDate?: Date | Timestamp | null;
  endDate?: Date | Timestamp | null;
  managerId: string;
  members?: string[];
  status?: 'active' | 'completed' | 'on-hold';
  createdAt: Date | Timestamp;
}

type NewProjectData = Omit<Project, 'id' | 'createdAt'>;

@Injectable({
  providedIn: 'root'
})

export class ProjectService {
  private firestore: Firestore = inject(Firestore);
  private projectsCollection: CollectionReference<Project>;

  constructor() { 
    this.projectsCollection = collection(this.firestore, 'Projects') as CollectionReference<Project>;
   }

   getProjects(): Observable<Project[]> {
    return collectionData<Project>(this.projectsCollection, {idField: 'id'})
   }

   getProject(projectId: string): Observable<Project | undefined> {
    const projectDocRef = doc(this.firestore, 'Projects', projectId) as DocumentReference<Project>;
    return docData<Project>(projectDocRef, { idField: 'id' });
   }

   createProject(projectData: NewProjectData): Promise<DocumentReference<DocumentData>> {
    const projectsCollectionRefForAdd = collection(this.firestore, 'Projects');
    return addDoc(projectsCollectionRefForAdd, {
      ...projectData,
      createdAt: serverTimestamp(),
    });
   }

   updateProject(projectId: string, updateData: Partial<Project>): Promise<void> {
    const projectDocRef = doc(this.firestore, 'Projects', projectId);
    return updateDoc(projectDocRef, updateData);
   }

   deleteProject(projectId: string): Promise<void> {
    const projectDocRef = doc(this.firestore, 'Projects', projectId);
    return deleteDoc(projectDocRef);
   }
}
