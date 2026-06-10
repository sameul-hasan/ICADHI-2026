import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  limit, 
  query,
  serverTimestamp 
} from "firebase/firestore";
import { auth, db } from "../services/firebase";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sign up method
  const register = async (email, password, fullName) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update Auth Profile
      await firebaseUpdateProfile(user, { displayName: fullName });

      // Default to "user" role with no access (requires admin promotion)
      const role = "user";

      const profileData = {
        uid: user.uid,
        email: user.email,
        fullName: fullName,
        role: role,
        createdAt: serverTimestamp()
      };

      // Save user profile to Firestore
      await setDoc(doc(db, "users", user.uid), profileData);
      setUserProfile(profileData);
      
      // Write audit log for new user signup
      try {
        await setDoc(doc(db, "auditLogs", `signup-${user.uid}-${Date.now()}`), {
          userId: user.uid,
          userEmail: user.email,
          userRole: role,
          action: "User Registered",
          details: `Registered as ${role}`,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.error("Audit log error on signup:", err);
      }

      return user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Log in method
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Log out method
  const logout = () => {
    setUserProfile(null);
    return signOut(auth);
  };

  // Listen to Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          } else {
            // Fallback profile if Firestore is missing it
            const fallbackProfile = {
              uid: user.uid,
              email: user.email,
              fullName: user.displayName || user.email.split("@")[0],
              role: "volunteer"
            };
            setUserProfile(fallbackProfile);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Helper check: permissions
  const role = userProfile?.role || "";
  
  const value = {
    currentUser,
    userProfile,
    role,
    loading,
    login,
    register,
    logout,
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "admin" || role === "super_admin",
    isRegDesk: role === "registration_desk" || role === "admin" || role === "super_admin",
    isBreakfastDesk: role === "breakfast_desk" || role === "admin" || role === "super_admin",
    isLunchDesk: role === "lunch_desk" || role === "admin" || role === "super_admin",
    isVolunteer: role !== ""
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
