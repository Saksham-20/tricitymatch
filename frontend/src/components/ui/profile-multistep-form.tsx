"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { CheckIcon, ArrowRightIcon } from "lucide-react"
import InterestTags from "../profile/InterestTags"
import ProfilePrompts from "../profile/ProfilePrompts"
import SocialMediaLinks from "../profile/SocialMediaLinks"
import SpotifyIntegration from "../profile/SpotifyIntegration"

interface ProfileMultiStepFormProps {
  initialData?: Record<string, any>
  onComplete: (data: Record<string, any>) => void
  onStepChange?: (step: number) => void
  isPremium?: boolean
  profile?: any
  onFileUpload?: (e: any, field: string) => void
}

export function ProfileMultiStepForm({ 
  initialData = {}, 
  onComplete, 
  onStepChange,
  isPremium = false,
  profile,
  onFileUpload
}: ProfileMultiStepFormProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>(initialData)

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    }
  }, [initialData])

  // Determine initial step based on completion
  useEffect(() => {
    if (initialData?.completionPercentage) {
      const completion = initialData.completionPercentage
      if (completion < 30) setCurrentStep(0)
      else if (completion < 50) setCurrentStep(1)
      else if (completion < 70) setCurrentStep(2)
      else if (completion < 85) setCurrentStep(3)
      else if (completion < 95) setCurrentStep(4)
      else setCurrentStep(5)
    }
  }, [initialData?.completionPercentage])

  const steps = [
    { id: 1, name: "Basic Info" },
    { id: 2, name: "Lifestyle" },
    { id: 3, name: "Education" },
    { id: 4, name: "Preferences" },
    { id: 5, name: "Personality" },
    { id: 6, name: "Enhanced" },
  ]

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      onStepChange?.(nextStep)
    } else {
      onComplete(formData)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleNestedChange = (parent: string, child: string, value: any) => {
    setFormData({
      ...formData,
      [parent]: {
        ...(formData[parent] || {}),
        [child]: value
      }
    })
  }

  const currentStepData = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  // Validation for each step
  const canProceed = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return formData.firstName && formData.lastName && formData.gender && formData.dateOfBirth && formData.city
      case 1: // Lifestyle
        return true // All optional
      case 2: // Education
        return true // All optional
      case 3: // Preferences
        return true // All optional
      case 4: // Personality
        return true // All optional
      case 5: // Enhanced
        return true // All optional
      default:
        return false
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Step Indicator */}
      <div className="mb-10 flex items-center justify-center gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2">
            <button
              onClick={() => index < currentStep && setCurrentStep(index)}
              disabled={index > currentStep}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ease-out border-2",
                "disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
                index < currentStep && "bg-green-600 text-white border-green-600 shadow-md",
                index === currentStep && "bg-primary-600 text-white border-primary-600 shadow-lg scale-110",
                index > currentStep && "bg-white text-gray-400 border-gray-300",
              )}
            >
              {index < currentStep ? (
                <CheckIcon className="h-5 w-5" strokeWidth={2.5} />
              ) : (
                <span className="text-sm font-semibold tabular-nums">{step.id}</span>
              )}
            </button>
            {index < steps.length - 1 && (
              <div className="relative h-0.5 w-12">
                <div className="absolute inset-0 bg-gray-200 rounded-full" />
                <div
                  className="absolute inset-0 bg-primary-600 rounded-full transition-all duration-500 ease-out origin-left"
                  style={{
                    transform: `scaleX(${index < currentStep ? 1 : 0})`,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="mb-8 overflow-hidden rounded-full bg-gray-100 h-1.5 border border-gray-200">
        <div
          className="h-full bg-primary-600 transition-all duration-700 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Form Content */}
      <div className="space-y-6">
        {/* Step 1: Basic Information */}
        {currentStep === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Basic Information</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium text-gray-900">
                  First Name *
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Enter your first name"
                  value={formData.firstName || ""}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className="h-12 border-2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium text-gray-900">
                  Last Name *
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Enter your last name"
                  value={formData.lastName || ""}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className="h-12 border-2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender" className="text-sm font-medium text-gray-900">
                  Gender *
                </Label>
                <select
                  id="gender"
                  value={formData.gender || ""}
                  onChange={(e) => handleInputChange("gender", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-900">
                  Date of Birth *
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth ? formData.dateOfBirth.split('T')[0] : ""}
                  onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                  className="h-12 border-2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-sm font-medium text-gray-900">
                  Height (cm)
                </Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="170"
                  value={formData.height || ""}
                  onChange={(e) => handleInputChange("height", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-sm font-medium text-gray-900">
                  Weight (kg)
                </Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="70"
                  value={formData.weight || ""}
                  onChange={(e) => handleInputChange("weight", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="city" className="text-sm font-medium text-gray-900">
                  City *
                </Label>
                <select
                  id="city"
                  value={formData.city || ""}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  required
                >
                  <option value="">Select City</option>
                  <option value="Chandigarh">Chandigarh</option>
                  <option value="Mohali">Mohali</option>
                  <option value="Panchkula">Panchkula</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Lifestyle */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Lifestyle</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="skinTone" className="text-sm font-medium text-gray-900">
                  Skin Tone
                </Label>
                <select
                  id="skinTone"
                  value={formData.skinTone || ""}
                  onChange={(e) => handleInputChange("skinTone", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="fair">Fair</option>
                  <option value="wheatish">Wheatish</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="diet" className="text-sm font-medium text-gray-900">
                  Diet
                </Label>
                <select
                  id="diet"
                  value={formData.diet || ""}
                  onChange={(e) => handleInputChange("diet", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="non-vegetarian">Non-Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="jain">Jain</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smoking" className="text-sm font-medium text-gray-900">
                  Smoking
                </Label>
                <select
                  id="smoking"
                  value={formData.smoking || ""}
                  onChange={(e) => handleInputChange("smoking", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="never">Never</option>
                  <option value="occasionally">Occasionally</option>
                  <option value="regularly">Regularly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="drinking" className="text-sm font-medium text-gray-900">
                  Drinking
                </Label>
                <select
                  id="drinking"
                  value={formData.drinking || ""}
                  onChange={(e) => handleInputChange("drinking", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="never">Never</option>
                  <option value="occasionally">Occasionally</option>
                  <option value="regularly">Regularly</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Education & Profession */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Education & Profession</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="education" className="text-sm font-medium text-gray-900">
                  Education
                </Label>
                <Input
                  id="education"
                  type="text"
                  placeholder="B.Tech, MBA, etc."
                  value={formData.education || ""}
                  onChange={(e) => handleInputChange("education", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="degree" className="text-sm font-medium text-gray-900">
                  Degree
                </Label>
                <Input
                  id="degree"
                  type="text"
                  placeholder="Computer Science, etc."
                  value={formData.degree || ""}
                  onChange={(e) => handleInputChange("degree", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profession" className="text-sm font-medium text-gray-900">
                  Profession
                </Label>
                <Input
                  id="profession"
                  type="text"
                  placeholder="Software Engineer, Doctor, etc."
                  value={formData.profession || ""}
                  onChange={(e) => handleInputChange("profession", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="income" className="text-sm font-medium text-gray-900">
                  Annual Income (₹)
                </Label>
                <Input
                  id="income"
                  type="number"
                  placeholder="500000"
                  value={formData.income || ""}
                  onChange={(e) => handleInputChange("income", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Preferences */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Partner Preferences</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preferredAgeMin" className="text-sm font-medium text-gray-900">
                  Preferred Age Min
                </Label>
                <Input
                  id="preferredAgeMin"
                  type="number"
                  placeholder="22"
                  value={formData.preferredAgeMin || ""}
                  onChange={(e) => handleInputChange("preferredAgeMin", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredAgeMax" className="text-sm font-medium text-gray-900">
                  Preferred Age Max
                </Label>
                <Input
                  id="preferredAgeMax"
                  type="number"
                  placeholder="30"
                  value={formData.preferredAgeMax || ""}
                  onChange={(e) => handleInputChange("preferredAgeMax", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredHeightMin" className="text-sm font-medium text-gray-900">
                  Preferred Height Min (cm)
                </Label>
                <Input
                  id="preferredHeightMin"
                  type="number"
                  placeholder="150"
                  value={formData.preferredHeightMin || ""}
                  onChange={(e) => handleInputChange("preferredHeightMin", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredHeightMax" className="text-sm font-medium text-gray-900">
                  Preferred Height Max (cm)
                </Label>
                <Input
                  id="preferredHeightMax"
                  type="number"
                  placeholder="170"
                  value={formData.preferredHeightMax || ""}
                  onChange={(e) => handleInputChange("preferredHeightMax", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredEducation" className="text-sm font-medium text-gray-900">
                  Preferred Education
                </Label>
                <Input
                  id="preferredEducation"
                  type="text"
                  placeholder="B.Tech, MBA, etc."
                  value={formData.preferredEducation || ""}
                  onChange={(e) => handleInputChange("preferredEducation", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredCity" className="text-sm font-medium text-gray-900">
                  Preferred City
                </Label>
                <select
                  id="preferredCity"
                  value={formData.preferredCity?.[0] || ""}
                  onChange={(e) => handleInputChange("preferredCity", [e.target.value])}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="Chandigarh">Chandigarh</option>
                  <option value="Mohali">Mohali</option>
                  <option value="Panchkula">Panchkula</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Personality */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Personality & Bio</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-sm font-medium text-gray-900">
                  Bio
                </Label>
                <textarea
                  id="bio"
                  value={formData.bio || ""}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-gray-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="familyOriented" className="text-sm font-medium text-gray-900">
                    Family Oriented
                  </Label>
                  <select
                    id="familyOriented"
                    value={formData.personalityValues?.familyOriented || ""}
                    onChange={(e) => handleNestedChange("personalityValues", "familyOriented", e.target.value)}
                    className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="careerFocused" className="text-sm font-medium text-gray-900">
                    Career Focused
                  </Label>
                  <select
                    id="careerFocused"
                    value={formData.personalityValues?.careerFocused || ""}
                    onChange={(e) => handleNestedChange("personalityValues", "careerFocused", e.target.value)}
                    className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jointFamily" className="text-sm font-medium text-gray-900">
                    Joint Family Preference
                  </Label>
                  <select
                    id="jointFamily"
                    value={formData.familyPreferences?.jointFamily || ""}
                    onChange={(e) => handleNestedChange("familyPreferences", "jointFamily", e.target.value)}
                    className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="children" className="text-sm font-medium text-gray-900">
                    Desired Children
                  </Label>
                  <Input
                    id="children"
                    type="number"
                    placeholder="0"
                    value={formData.familyPreferences?.children || ""}
                    onChange={(e) => handleNestedChange("familyPreferences", "children", e.target.value)}
                    className="h-12 border-2"
                  />
                </div>
              </div>

              {profile && onFileUpload && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">
                    Profile Photo
                  </Label>
                  <div className="flex items-center gap-4">
                    {profile.profilePhoto && (
                      <img
                        src={`http://localhost:5000${profile.profilePhoto}`}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                      />
                    )}
                    <label className="btn-secondary cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onFileUpload(e, 'profilePhoto')}
                        className="hidden"
                      />
                      Upload Photo
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 6: Enhanced */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Enhanced Profile Features</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>
            
            <p className="text-gray-600 text-sm mb-6">
              Add more details to make your profile stand out and attract better matches!
            </p>

            <div className="space-y-6">
              {/* Interest Tags */}
              <InterestTags
                tags={formData.interestTags || []}
                onChange={(tags) => handleInputChange("interestTags", tags)}
              />

              {/* Profile Prompts */}
              <ProfilePrompts
                prompts={formData.profilePrompts || {}}
                onChange={(prompts) => handleInputChange("profilePrompts", prompts)}
              />

              {/* Spotify Integration */}
              <SpotifyIntegration
                playlistUrl={formData.spotifyPlaylist || ""}
                onChange={(url) => handleInputChange("spotifyPlaylist", url)}
              />

              {/* Social Media Links */}
              <SocialMediaLinks
                links={formData.socialMediaLinks || {}}
                onChange={(links) => handleInputChange("socialMediaLinks", links)}
                isPremium={isPremium}
              />

              {/* Languages */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">
                  Languages You Speak
                </Label>
                <div className="flex flex-wrap gap-2">
                  {['Hindi', 'English', 'Punjabi', 'Urdu', 'Sanskrit', 'Other'].map((lang) => {
                    const isSelected = (formData.languages || []).includes(lang)
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          const current = formData.languages || []
                          const updated = isSelected
                            ? current.filter(l => l !== lang)
                            : [...current, lang]
                          handleInputChange("languages", updated)
                        }}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium transition-colors border-2",
                          isSelected
                            ? "bg-primary-600 text-white border-primary-600"
                            : "bg-white text-gray-700 border-gray-300 hover:border-blue-300"
                        )}
                      >
                        {lang}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Personality Type */}
              <div className="space-y-2">
                <Label htmlFor="personalityType" className="text-sm font-medium text-gray-900">
                  Personality Type (Optional)
                </Label>
                <select
                  id="personalityType"
                  value={formData.personalityType || ""}
                  onChange={(e) => handleInputChange("personalityType", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select (Optional)</option>
                  <option value="INTJ">INTJ - The Architect</option>
                  <option value="INTP">INTP - The Thinker</option>
                  <option value="ENTJ">ENTJ - The Commander</option>
                  <option value="ENTP">ENTP - The Debater</option>
                  <option value="INFJ">INFJ - The Advocate</option>
                  <option value="INFP">INFP - The Mediator</option>
                  <option value="ENFJ">ENFJ - The Protagonist</option>
                  <option value="ENFP">ENFP - The Campaigner</option>
                  <option value="ISTJ">ISTJ - The Logistician</option>
                  <option value="ISFJ">ISFJ - The Protector</option>
                  <option value="ESTJ">ESTJ - The Executive</option>
                  <option value="ESFJ">ESFJ - The Consul</option>
                  <option value="ISTP">ISTP - The Virtuoso</option>
                  <option value="ISFP">ISFP - The Adventurer</option>
                  <option value="ESTP">ESTP - The Entrepreneur</option>
                  <option value="ESFP">ESFP - The Entertainer</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Knowing your personality type helps us find better matches
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {currentStep > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const prevStep = currentStep - 1
                setCurrentStep(prevStep)
                onStepChange?.(prevStep)
              }}
              className="flex-1 h-14 text-base font-semibold border-2"
            >
              ← Previous
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className={cn(
              "flex-1 h-14 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200",
              currentStep === 0 && "w-full",
              !canProceed() && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              {currentStep === steps.length - 1 ? "Complete Profile" : "Continue"}
              <ArrowRightIcon
                className="h-5 w-5 transition-transform group-hover:translate-x-1 duration-300"
                strokeWidth={2.5}
              />
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
