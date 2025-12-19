import { useState } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Briefcase } from "lucide-react";
import { Link } from "wouter";
import proLandingBg from "@assets/Professional_landing_1764572940964.png";

export default function ProLoginPage() {
  const { signIn, signUp } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await signUp(email, password, fullName, true);
      setSuccess("Account created! Please check your email to verify your account.");
      setEmail("");
      setPassword("");
      setFullName("");
    } catch (err: any) {
      setError(err.message || "Sign up failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="flex min-h-screen flex-col relative"
      style={{
        backgroundImage: `url(${proLandingBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="flex flex-1 items-center justify-center p-4 relative z-10">
        <Card className="w-full max-w-md bg-background/95 backdrop-blur-sm">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <Briefcase className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">LOBA Pro</CardTitle>
            <CardDescription className="text-center">
              Professional portal for fitness trainers, nutritionists, and coaches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" data-testid="tab-signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="input-signin-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="input-signin-password"
                    />
                  </div>
                  {error && (
                    <div className="text-sm text-destructive" data-testid="text-error">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="text-sm text-green-600" data-testid="text-success">
                      {success}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-signin"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Smith"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="input-signup-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
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
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      minLength={6}
                      data-testid="input-signup-password"
                    />
                  </div>
                  {error && (
                    <div className="text-sm text-destructive" data-testid="text-error">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="text-sm text-green-600" data-testid="text-success">
                      {success}
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
            
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <Link href="/" className="hover:underline" data-testid="link-client-app">
                Looking for the client app? Go here
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
