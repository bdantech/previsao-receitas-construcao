import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  userRole: string | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  setDirectAuth: (session: Session, role: string) => void;
  getAuthHeader: () => Record<string, string>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userRole: null,
  isLoading: true,
  signOut: async () => {},
  setDirectAuth: () => {},
  getAuthHeader: () => ({}),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Function to get auth header for API requests
  const getAuthHeader = () => {
    if (session?.access_token) {
      return {
        Authorization: `Bearer ${session.access_token}`
      };
    }
    return {};
  };

  // Function to directly set authentication state from login response
  const setDirectAuth = (newSession: Session, role: string) => {
    console.log("[useAuth] Setting direct auth with session and role:", role);
    setSession(newSession);
    setUser(newSession?.user ?? null);
    setUserRole(role);
    setIsLoading(false);
  };

  // Function to fetch user role
  const fetchUserRole = async (userId: string) => {
    console.log("[useAuth] Fetching user role for ID:", userId);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
        
      if (profileError) {
        console.error('[useAuth] Error fetching user role:', profileError);
        return null;
      }
      
      console.log("[useAuth] Profile data retrieved:", profileData);
      return profileData?.role || null;
    } catch (error) {
      console.error('[useAuth] Exception fetching user role:', error);
      return null;
    }
  };

  useEffect(() => {
    const setData = async () => {
      try {
        console.log("[useAuth] Getting initial session");
        // First try to get the session from localStorage
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        console.log("[useAuth] Auth state changed: INITIAL_SESSION", session);
        
        if (session) {
          // Try to refresh the session
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshData.session) {
            setSession(refreshData.session);
            setUser(refreshData.session.user);
            const role = await fetchUserRole(refreshData.session.user.id);
            setUserRole(role);
            console.log("[useAuth] Session refreshed and role set:", role);
          } else {
            console.log("[useAuth] Session refresh failed, using original session");
            setSession(session);
            setUser(session.user);
            const role = await fetchUserRole(session.user.id);
            setUserRole(role);
          }
        } else {
          console.log("[useAuth] No session found");
          setSession(null);
          setUser(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error('[useAuth] Error getting session:', error);
        setSession(null);
        setUser(null);
        setUserRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    setData();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[useAuth] Auth state changed:", event, session?.user?.id);
        
        if (session) {
          setSession(session);
          setUser(session.user);
          const role = await fetchUserRole(session.user.id);
          setUserRole(role);
          console.log("[useAuth] Auth state changed: user role set to:", role);
        } else {
          setSession(null);
          setUser(null);
          setUserRole(null);
          console.log("[useAuth] Auth state changed: session cleared");
        }
        
        setIsLoading(false);
      }
    );

    // Cleanup function
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      console.log("[useAuth] User signed out");
    } catch (error) {
      console.error("[useAuth] Error signing out:", error);
    }
  };

  const value = {
    session,
    user,
    userRole,
    isLoading,
    signOut,
    setDirectAuth,
    getAuthHeader,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
