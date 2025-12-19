import { useState } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft } from "lucide-react";
import logoUrl from "@assets/loba-logo.png";
import backgroundUrl from "@assets/Background_image_client_landing_1764570400719.png";

export default function LoginPage() {
  const { signIn, signUp } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      await signUp(email, password, fullName, false);
      setSuccessMessage("Account created! You can now log in with your credentials.");
      setActiveTab("login");
    } catch (err: any) {
      setError(err.message || "Sign up failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl,
      });
      
      if (error) throw error;
      
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setResetSent(false);
    setResetEmail("");
    setError("");
  };

  return (
    <div 
      className="flex min-h-screen flex-col relative"
      style={{
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark wash overlay for text readability */}
      <div className="absolute inset-0 bg-black/50" />
      
      <div className="flex flex-1 flex-col items-center justify-center p-4 relative z-10">
        <Card className="w-full max-w-md bg-card/95 backdrop-blur-sm">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <img 
                src={logoUrl} 
                alt="LOBA Logo" 
                className="h-20 w-auto"
                data-testid="img-logo"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-center">LOBA Tracker</CardTitle>
            <CardDescription className="text-center">
              Track your nutrition, workouts, and health goals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showForgotPassword ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </button>
                
                {resetSent ? (
                  <div className="space-y-4 text-center py-4">
                    <div className="flex justify-center">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold">Check your email</h3>
                    <p className="text-sm text-muted-foreground">
                      We've sent a password reset link to <strong>{resetEmail}</strong>. 
                      Click the link in the email to reset your password.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Didn't receive it? Check your spam folder or try again.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setResetSent(false);
                        setResetEmail("");
                      }}
                      data-testid="button-try-again"
                    >
                      Try another email
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Reset your password</h3>
                      <p className="text-sm text-muted-foreground">
                        Enter your email address and we'll send you a link to reset your password.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="Enter your email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        disabled={isLoading}
                        required
                        data-testid="input-reset-email"
                      />
                    </div>
                    {error && (
                      <div className="text-sm text-destructive" data-testid="text-reset-error">
                        {error}
                      </div>
                    )}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || !resetEmail}
                      data-testid="button-send-reset"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Reset Link"
                      )}
                    </Button>
                  </form>
                )}
              </div>
            ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" data-testid="tab-login">Log In</TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="input-password"
                    />
                  </div>
                  {successMessage && activeTab === "login" && (
                    <div className="text-sm text-green-600 dark:text-green-400" data-testid="text-success">
                      {successMessage}
                    </div>
                  )}
                  {error && activeTab === "login" && (
                    <div className="text-sm text-destructive" data-testid="text-error">
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      "Log In"
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="w-full text-sm text-muted-foreground hover:text-foreground hover:underline mt-2"
                    data-testid="link-forgot-password"
                  >
                    Forgot your password?
                  </button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="input-fullname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="input-signup-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password (min 6 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      minLength={6}
                      data-testid="input-signup-password"
                    />
                  </div>
                  {error && activeTab === "signup" && (
                    <div className="text-sm text-destructive" data-testid="text-signup-error">
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-signup"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
        </Card>
        
        {/* Development links - remove before production */}
        <div className="mt-6 flex justify-center gap-4 text-sm text-white/70">
          <a 
            href="/pro/login" 
            className="hover:text-white hover:underline"
            data-testid="link-pro-login"
          >
            Professional Login
          </a>
          <span>|</span>
          <a 
            href="/admin" 
            className="hover:text-white hover:underline"
            data-testid="link-admin-login"
          >
            Admin Login
          </a>
        </div>
      </div>
      <footer className="relative z-10 py-4 text-center text-sm text-white/70">
        <p>&copy; {new Date().getFullYear()} LOBA Systems. All rights reserved.</p>
      </footer>
    </div>
  );
}
