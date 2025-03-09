
import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  userRole: string | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userRole: null,
  isLoading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const role = await fetchUserRole(session.user.id);
          setUserRole(role);
          console.log("[useAuth] Initial user role set:", role);
        }
      } catch (error) {
        console.error('[useAuth] Error getting session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setData();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[useAuth] Auth state changed:", event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const role = await fetchUserRole(session.user.id);
          setUserRole(role);
          console.log("[useAuth] Auth state changed: user role set to:", role);
        } else {
          setUserRole(null);
          console.log("[useAuth] Auth state changed: user role cleared");
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
