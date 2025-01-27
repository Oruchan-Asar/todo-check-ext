import React, { useEffect, useState } from "react";
import { FaSync } from "react-icons/fa";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { ScrollArea } from "../components/ui/scroll-area";
import { ModeToggle } from "../components/mode-toggle";
import { cn } from "../lib/utils";

interface Routine {
  id: string;
  text: string;
  url?: string;
  completed: boolean;
  createdAt: string;
}

interface WebAppRoutine {
  id: string;
  title: string;
  url?: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChromeCookie {
  name: string;
  value: string;
  domain: string;
  hostOnly: boolean;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  session: boolean;
  expirationDate?: number;
  storeId: string;
}

export function Popup() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [newRoutine, setNewRoutine] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    console.log("Authentication Status:", isAuthenticated);
  }, [isAuthenticated]);

  useEffect(() => {
    // Load routines and history from storage
    chrome.storage.local.get(
      ["currentRoutines", "routineHistory"],
      (result) => {
        console.log("Local Storage Routines:", result.currentRoutines || []);
        setRoutines(result.currentRoutines || []);
      }
    );

    // Check authentication status
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Get the next-auth.session-token cookie
      const cookie = await new Promise<ChromeCookie | null>((resolve) => {
        chrome.cookies.get(
          {
            url: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
            name: "next-auth.session-token",
          },
          (cookie) => resolve(cookie)
        );
      });

      console.log("Session Cookie:", cookie);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/check`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
            Cookie: cookie ? `next-auth.session-token=${cookie.value}` : "",
          },
        }
      );

      console.log("Auth Response Status:", response.status);
      console.log("Response Headers:", Object.fromEntries(response.headers));
      console.log("Current Cookies:", document.cookie);

      const data = await response.json();
      console.log("Auth Response Data:", data);

      setIsAuthenticated(data.authenticated);

      if (data.authenticated) {
        // Fetch routines if authenticated
        const routinesResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/routines`,
          {
            credentials: "include",
          }
        );
        if (routinesResponse.ok) {
          const dbRoutines = await routinesResponse.json();
          console.log("Database Routines:", dbRoutines);
        } else {
          console.log(
            "Error fetching routines from database:",
            routinesResponse.status
          );
        }
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsAuthenticated(false);
    }
  };

  const syncWithWebApp = async () => {
    if (!isAuthenticated) {
      // Open the login page in a new tab if not authenticated
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      chrome.tabs.create({ url: `${apiUrl}/login` }, (tab) => {
        // Add listener for tab updates
        chrome.tabs.onUpdated.addListener(async function listener(tabId, info) {
          // Check if it's our tab and it's done loading
          if (tabId === tab.id && info.status === "complete") {
            // Remove the listener
            chrome.tabs.onUpdated.removeListener(listener);

            // Wait a bit to ensure the session is properly set
            setTimeout(async () => {
              // Recheck auth status
              await checkAuthStatus();
              // If now authenticated, sync
              if (isAuthenticated) {
                await syncWithWebApp();
              }
            }, 1000);
          }
        });
      });
      return;
    }

    setIsSyncing(true);
    try {
      // Get web app routines
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/routines`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch routines from web app");
      }

      const webAppRoutines = (await response.json()) as WebAppRoutine[];
      console.log("Fetched web app routines:", webAppRoutines);

      // Convert web app routines to extension format
      const convertedWebAppRoutines = webAppRoutines.map(
        (routine: WebAppRoutine) => ({
          id: routine.id,
          text: routine.title,
          url: routine.url,
          completed: routine.completed,
          createdAt: routine.createdAt,
        })
      );

      // Update local storage and state with web app routines
      chrome.storage.local.set(
        { currentRoutines: convertedWebAppRoutines },
        () => {
          console.log(
            "Updated local storage with web app routines:",
            convertedWebAppRoutines
          );
          setRoutines(convertedWebAppRoutines);
        }
      );
    } catch (error) {
      console.error("Error syncing with web app:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const addRoutine = async () => {
    if (!newRoutine.trim()) return;

    const routine: Routine = {
      id: crypto.randomUUID(),
      text: newRoutine,
      url: newUrl.trim() || undefined,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const updatedRoutines = [...routines, routine];
    setRoutines(updatedRoutines);
    chrome.storage.local.set({ currentRoutines: updatedRoutines });
    setNewRoutine("");
    setNewUrl("");
    setShowInput(false);
  };

  const toggleRoutine = async (id: string) => {
    const updatedRoutines = routines.map((routine) =>
      routine.id === id
        ? { ...routine, completed: !routine.completed }
        : routine
    );

    const routine = updatedRoutines.find((r) => r.id === id);
    if (routine?.completed && routine.url) {
      // Find and close matching tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.url?.includes(routine.url!)) {
            chrome.tabs.remove(tab.id!);
          }
        });
      });
    }

    // Update local storage first for immediate feedback
    chrome.storage.local.set({ currentRoutines: updatedRoutines });
    setRoutines(updatedRoutines);

    // If authenticated, update in database
    if (isAuthenticated) {
      try {
        const routineToUpdate = updatedRoutines.find(
          (routine) => routine.id === id
        );
        if (!routineToUpdate) return;

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/routines/${id}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              completed: routineToUpdate.completed,
            }),
          }
        );

        if (!response.ok) {
          console.error(
            "Failed to update routine in database:",
            response.status
          );
          // Revert local changes if database update fails
          const revertedRoutines = routines.map((routine) =>
            routine.id === id
              ? { ...routine, completed: !routine.completed }
              : routine
          );
          chrome.storage.local.set({ currentRoutines: revertedRoutines });
          setRoutines(revertedRoutines);
        }
      } catch (error) {
        console.error("Error updating routine in database:", error);
        // Revert local changes if database update fails
        const revertedRoutines = routines.map((routine) =>
          routine.id === id
            ? { ...routine, completed: !routine.completed }
            : routine
        );
        chrome.storage.local.set({ currentRoutines: revertedRoutines });
        setRoutines(revertedRoutines);
      }
    }
  };

  const deleteRoutine = async (id: string) => {
    const routineToDelete = routines.find((routine) => routine.id === id);
    console.log("Deleting Routine:", routineToDelete);
    const updatedRoutines = routines.filter((routine) => routine.id !== id);
    console.log("Updated Routines List After Deletion:", updatedRoutines);

    // Delete from local storage
    chrome.storage.local.set({ currentRoutines: updatedRoutines });
    setRoutines(updatedRoutines);

    // If authenticated, also delete from database
    if (isAuthenticated) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/routines/${id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        if (!response.ok) {
          console.error(
            "Failed to delete routine from database:",
            response.status
          );
          // Optionally revert the local deletion if db deletion fails
          chrome.storage.local.set({ currentRoutines: routines });
          setRoutines(routines);
        }
      } catch (error) {
        console.error("Error deleting routine from database:", error);
        // Optionally revert the local deletion if db deletion fails
        chrome.storage.local.set({ currentRoutines: routines });
        setRoutines(routines);
      }
    }
  };

  const editRoutine = async (id: string, newText: string) => {
    const updatedRoutines = routines.map((routine) =>
      routine.id === id
        ? {
            ...routine,
            text: newText,
            url: editUrl.trim() || undefined,
          }
        : routine
    );

    setRoutines(updatedRoutines);
    chrome.storage.local.set({ currentRoutines: updatedRoutines });
    setEditingRoutine(null);
    setEditText("");
    setEditUrl("");
  };

  const startEditing = (routine: Routine) => {
    setEditingRoutine(routine.id);
    setEditText(routine.text);
    setEditUrl(routine.url || "");
  };

  return (
    <div className="w-[350px] p-4 bg-background text-foreground">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Routine Check</h1>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button
            variant="outline"
            size="icon"
            onClick={syncWithWebApp}
            disabled={isSyncing}
          >
            <FaSync className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {!isAuthenticated && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Sign in to sync your routines across devices
            </p>
            <Button onClick={syncWithWebApp} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      )}

      <ScrollArea className="h-[400px] pr-4">
        {showInput ? (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-2">
              <Input
                placeholder="Routine name"
                value={newRoutine}
                onChange={(e) => setNewRoutine(e.target.value)}
                className="mb-2"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    addRoutine();
                  }
                }}
              />
              <Input
                placeholder="URL (optional)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="mb-2"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    addRoutine();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button onClick={addRoutine} className="flex-1">
                  Add
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowInput(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button
            onClick={() => setShowInput(true)}
            className="w-full mb-4"
            variant="outline"
          >
            Add New Routine
          </Button>
        )}

        <div className="space-y-2">
          {routines.map((routine) => (
            <Card key={routine.id} className="relative">
              <CardContent className="p-4">
                {editingRoutine === routine.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="mb-2"
                    />
                    <Input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="URL (optional)"
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => editRoutine(routine.id, editText)}
                        className="flex-1"
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditingRoutine(null)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={routine.completed}
                      onCheckedChange={() => toggleRoutine(routine.id)}
                      id={routine.id}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={routine.id}
                        className={cn(
                          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                          routine.completed && "line-through opacity-50"
                        )}
                      >
                        {routine.text}
                      </label>
                      {routine.url && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {routine.url}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(routine)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRoutine(routine.id)}
                        className="text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
