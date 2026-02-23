import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, Upload, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [locationPref, setLocationPref] = useState("remote");
  const [minSalary, setMinSalary] = useState<string>("");
  const [experienceLevel, setExperienceLevel] = useState("mid");
  const [skills, setSkills] = useState<string[]>([]);
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([]);
  const [keywordBlacklist, setKeywordBlacklist] = useState<string[]>([]);
  const [maxApps, setMaxApps] = useState("15");
  const [resumeFilePath, setResumeFilePath] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [newExcluded, setNewExcluded] = useState("");
  const [newBlacklist, setNewBlacklist] = useState("");

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from("user_profile")
      .select("*")
      .eq("user_id", user!.id)
      .single();

    if (data) {
      setTargetTitles(data.target_titles || []);
      setIndustries(data.industries || []);
      setLocationPref(data.location_preference || "remote");
      setMinSalary(data.min_salary?.toString() || "");
      setExperienceLevel(data.experience_level || "mid");
      setSkills(data.skills || []);
      setExcludedCompanies(data.excluded_companies || []);
      setKeywordBlacklist(data.keyword_blacklist || []);
      setMaxApps(data.max_applications_per_run?.toString() || "15");
      setResumeFilePath(data.resume_file_path);
    }
    if (error && error.code !== "PGRST116") {
      toast({ title: "Error loading profile", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("user_profile")
      .update({
        target_titles: targetTitles,
        industries,
        location_preference: locationPref,
        min_salary: minSalary ? parseInt(minSalary) : null,
        experience_level: experienceLevel,
        skills,
        excluded_companies: excludedCompanies,
        keyword_blacklist: keywordBlacklist,
        max_applications_per_run: parseInt(maxApps) || 15,
      })
      .eq("user_id", user!.id);

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile saved" });
    }
    setSaving(false);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);

    const filePath = `${user.id}/resume-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("user_profile")
      .update({ resume_file_path: filePath })
      .eq("user_id", user.id);

    if (!updateError) {
      setResumeFilePath(filePath);
      toast({ title: "Resume uploaded" });
    }
    setUploading(false);
  };

  const addTag = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    inputSetter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const trimmed = value.trim();
    if (trimmed) {
      setter((prev) => [...prev, trimmed]);
      inputSetter("");
    }
  };

  const removeTag = (
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const TagInput = ({
    label,
    tags,
    setter,
    inputValue,
    inputSetter,
    placeholder,
  }: {
    label: string;
    tags: string[];
    setter: React.Dispatch<React.SetStateAction<string[]>>;
    inputValue: string;
    inputSetter: React.Dispatch<React.SetStateAction<string>>;
    placeholder: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, i) => (
          <Badge key={i} variant="secondary" className="gap-1">
            {tag}
            <button onClick={() => removeTag(i, setter)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => inputSetter(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(inputValue, setter, inputSetter);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => addTag(inputValue, setter, inputSetter)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-2xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Profile & Preferences</h1>
          <p className="mt-1 text-muted-foreground">Configure your job search criteria</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Job Criteria</CardTitle>
              <CardDescription>What kind of roles are you looking for?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <TagInput
                label="Target Job Titles"
                tags={targetTitles}
                setter={setTargetTitles}
                inputValue={newTitle}
                inputSetter={setNewTitle}
                placeholder="e.g. Frontend Engineer"
              />
              <TagInput
                label="Industries"
                tags={industries}
                setter={setIndustries}
                inputValue={newIndustry}
                inputSetter={setNewIndustry}
                placeholder="e.g. FinTech"
              />
              <TagInput
                label="Key Skills"
                tags={skills}
                setter={setSkills}
                inputValue={newSkill}
                inputSetter={setNewSkill}
                placeholder="e.g. React"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Location Preference</Label>
                  <Select value={locationPref} onValueChange={setLocationPref}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="any">Any</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Experience Level</Label>
                  <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry</SelectItem>
                      <SelectItem value="mid">Mid</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="executive">Executive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Minimum Salary ($)</Label>
                  <Input
                    type="number"
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value)}
                    placeholder="e.g. 120000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Applications Per Run</Label>
                  <Input
                    type="number"
                    value={maxApps}
                    onChange={(e) => setMaxApps(e.target.value)}
                    placeholder="15"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exclusions</CardTitle>
              <CardDescription>Filter out unwanted jobs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <TagInput
                label="Excluded Companies"
                tags={excludedCompanies}
                setter={setExcludedCompanies}
                inputValue={newExcluded}
                inputSetter={setNewExcluded}
                placeholder="e.g. Meta"
              />
              <TagInput
                label="Keyword Blacklist"
                tags={keywordBlacklist}
                setter={setKeywordBlacklist}
                inputValue={newBlacklist}
                inputSetter={setNewBlacklist}
                placeholder="e.g. unpaid"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resume</CardTitle>
              <CardDescription>Upload your master resume (PDF)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {resumeFilePath && (
                <p className="text-sm text-muted-foreground">
                  Current: <span className="font-mono text-xs">{resumeFilePath.split("/").pop()}</span>
                </p>
              )}
              <div className="flex items-center gap-4">
                <Button variant="outline" className="gap-2" asChild disabled={uploading}>
                  <label className="cursor-pointer">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Uploading..." : "Upload PDF"}
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleResumeUpload}
                    />
                  </label>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button onClick={saveProfile} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Preferences
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
