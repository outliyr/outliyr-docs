# Modifying & Extending Lyra's Settings System

One of the strengths of Lyra's settings system is its extensibility. Whether you need to add entirely new configuration options or tweak existing ones, the framework is designed to accommodate such changes. This section will guide you through the common workflows for modifying and extending the system.

***

### **Core Workflow: Adding a New Setting (Step-by-Step)**

Adding a new setting to Lyra generally involves touching both the backend C++ classes (`ULyraSettingsShared` or `ULyraSettingsLocal`) and the UI registration layer (`ULyraGameSettingRegistry`).

### **Step 1: Choose the Right Backend Storage**

Before writing any code, decide where your new setting logically belongs:

* **`ULyraSettingsShared`:**
  * **Use if:** The setting is a player preference, should be consistent across different machines for the same player, and is suitable for cloud saving.
  * **Examples:** A new accessibility option (e.g., "Text-to-Speech for UI"), a gameplay preference (e.g., "Auto-Reload Weapon"), a cosmetic preference.
* **`ULyraSettingsLocal`:**
  * **Use if:** The setting is specific to the local machine's hardware or environment, or affects local performance.
  * **Examples:** A new specific graphics option (e.g., "Motion Blur Quality"), a hardware-specific toggle (e.g., "Enable DLSS Frame Generation"), a setting for a custom performance stat.

### **Step 2: Implement the Backend Logic in C++**

Once you've chosen the backend class:

1. **Declare the Property:**
   * In the header file (`.h`) of your chosen class (`ULyraSettingsShared.h` or `ULyraSettingsLocal.h`), declare a new property to hold the setting's value.
   * Use `UPROPERTY()` for `ULyraSettingsShared` (for SaveGame serialization).
   * Use `UPROPERTY(Config)` for `ULyraSettingsLocal` (for GameUserSettings.ini serialization).
   *   Example (`ULyraSettingsShared.h`):

       ```cpp
       UPROPERTY()
       bool bEnableAutoReload = true;
       ```
   *   Example (`ULyraSettingsLocal.h`):

       ```cpp
       UPROPERTY(Config)
       int32 MotionBlurQuality = 2; // 0=Off, 1=Low, 2=Medium, 3=High
       ```
2. **Create Getter and Setter Functions:**
   * In the header, declare `UFUNCTION()` getter and setter methods for your new property.
   * In the source file (`.cpp`), implement these methods.
   * **For `ULyraSettingsShared` setters, use `ChangeValueAndDirty()`** to update the property, set the dirty flag, and broadcast the `OnSettingChanged` event.
   *   Example (`ULyraSettingsShared.h`):

       ```cpp
       UFUNCTION()
       bool GetEnableAutoReload() const { return bEnableAutoReload; }
       UFUNCTION()
       void SetEnableAutoReload(bool bNewValue);
       ```
   *   Example (`ULyraSettingsShared.cpp`):

       ```cpp
       void ULyraSettingsShared::SetEnableAutoReload(bool bNewValue)
       {
           if (ChangeValueAndDirty(bEnableAutoReload, bNewValue))
           {
               // Optional: If this setting needs immediate application outside of ApplySettings(), do it here.
               // Otherwise, rely on ApplySettings().
           }
       }
       ```
   * **For `ULyraSettingsLocal` setters,** simply assign the value. The `UGameUserSettings` system handles dirtying and saving when `SaveSettings()` is called.
   *   Example (`ULyraSettingsLocal.h`):

       ```cpp
       UFUNCTION()
       int32 GetMotionBlurQuality() const { return MotionBlurQuality; }
       UFUNCTION()
       void SetMotionBlurQuality(int32 NewValue);
       ```
   *   Example (`ULyraSettingsLocal.cpp`):

       ```cpp
       void ULyraSettingsLocal::SetMotionBlurQuality(int32 NewValue)
       {
           MotionBlurQuality = FMath::Clamp(NewValue, 0, 3);
           // Application of this setting will typically happen in ApplyNonResolutionSettings()
           // or directly via CVars if preferred for immediate effect.
       }
       ```
3. **Update Application Logic (If Necessary):**
   * If your setting needs to be actively applied to an engine or game subsystem, update the relevant "Apply" method:
     * For `ULyraSettingsShared`: Modify `ULyraSettingsShared::ApplySettings()`.
     * For `ULyraSettingsLocal`: Modify `ULyraSettingsLocal::ApplyNonResolutionSettings()` (or `ApplyScalabilitySettings()` if it's a scalability group, or handle it directly in the setter if it controls a CVar that takes effect immediately).
   *   Example (`ULyraSettingsLocal.cpp` - applying motion blur quality):

       ```cpp
       void ULyraSettingsLocal::ApplyNonResolutionSettings()
       {
           Super::ApplyNonResolutionSettings(); // Call parent first

           // ... other settings ...

           // Apply Motion Blur Quality (example: setting a CVar)
           static IConsoleVariable* CVarMotionBlurQuality = IConsoleManager::Get().FindConsoleVariable(TEXT("r.MotionBlurQuality"));
           if (CVarMotionBlurQuality)
           {
               CVarMotionBlurQuality->Set(MotionBlurQuality, ECVF_SetByGameSetting);
           }
       }
       ```
4. **Set Default Value:**
   * Ensure your property has a sensible default value either in its declaration or in the constructor of the settings class.
   * For `ULyraSettingsLocal`, also set this default in `ULyraSettingsLocal::SetToDefaults()`.

### **Step 3: Register the Setting in `ULyraGameSettingRegistry`**

Now, make the setting visible and configurable in the UI:

1. **Locate the Appropriate Registry File:**
   * Open the relevant `LyraGameSettingRegistry_*.cpp` file based on the category of your setting (e.g., `LyraGameSettingRegistry_Gameplay.cpp` for gameplay options, `LyraGameSettingRegistry_Video.cpp` for graphics).
2. **Find or Create a `UGameSettingCollection` (UI Grouping):**
   * Settings in Lyra's UI are organized into groups and subgroups. This visual structure is directly determined by how `UGameSettingCollection` objects are created and nested within the `Initialize[...]Settings` functions of `ULyraGameSettingRegistry`.
   * **Identify Target Collection:**
     * For our **"Auto-Reload Weapon"** setting (a gameplay preference), we'd look in `ULyraGameSettingRegistry_Gameplay.cpp`. We'd likely add it to an existing general gameplay `UGameSettingCollection`, perhaps one named `GameplayPreferencesCollection` or similar. If no suitable general collection exists, we might create one.
     * For our **"Motion Blur Quality"** setting (a graphics option), we'd look in `ULyraGameSettingRegistry_Video.cpp`. This would likely go into a `UGameSettingCollection` representing "Graphics Quality" or perhaps "Advanced Graphics," depending on its nature.
   *   **Creating New Subsections:** If you were adding several related gameplay mechanics (e.g., "Auto-Reload," "Auto-Equip Best Weapon," "Auto-Use Medkit"), you might create a new `UGameSettingCollection` for them:

       ```cpp
       // In LyraGameSettingRegistry_Gameplay.cpp, assuming 'MainGameplayCollection' exists
       UGameSettingCollection* AutoAssistCollection = NewObject<UGameSettingCollection>();
       AutoAssistCollection->SetDevName(TEXT("AutoAssistFeatures"));
       AutoAssistCollection->SetDisplayName(LOCTEXT("AutoAssist_Name", "Automatic Assists"));
       MainGameplayCollection->AddSetting(AutoAssistCollection);
       // Our "Auto-Reload Weapon" setting would then be added to AutoAssistCollection
       ```
   *   **Creating New Pages:** If "Motion Blur Quality" was part of a larger, detailed set of "Advanced Post-Processing Effects" that deserved its own screen:

       ```cpp
       // In LyraGameSettingRegistry_Video.cpp, assuming 'AdvancedGraphicsCollection' exists
       UGameSettingCollectionPage* PostProcessingPage = NewObject<UGameSettingCollectionPage>();
       PostProcessingPage->SetDevName(TEXT("PostProcessingPage"));
       PostProcessingPage->SetDisplayName(LOCTEXT("PostProcessingPage_Name", "Post-Processing Effects"));
       PostProcessingPage->SetNavigationText(LOCTEXT("PostProcessingPage_Nav", "Details"));
       AdvancedGraphicsCollection->AddSetting(PostProcessingPage);
       // Our "Motion Blur Quality" setting would then be added as a child to PostProcessingPage
       // (often via another UGameSettingCollection that's a child of PostProcessingPage).
       ```
   * The `DisplayName` of the `UGameSettingCollection` is what users see as the section header or page title. The organization is purely based on these `AddSetting` calls creating a tree-like structure.
3. **Create the `UGameSettingValue*` Object:**
   * Instantiate the appropriate `UGameSettingValue` derived class for your setting.
   * Set its `DevName`, `DisplayName` (what the user sees for _this specific setting_), and `DescriptionRichText`.
   *   **For "Auto-Reload Weapon" (boolean):**

       ```cpp
       // In LyraGameSettingRegistry_Gameplay.cpp
       UGameSettingValueDiscreteDynamic_Bool* AutoReloadSetting = NewObject<UGameSettingValueDiscreteDynamic_Bool>();
       AutoReloadSetting->SetDevName(TEXT("EnableAutoReload"));
       AutoReloadSetting->SetDisplayName(LOCTEXT("EnableAutoReload_Name", "Auto-Reload Weapon"));
       AutoReloadSetting->SetDescriptionRichText(LOCTEXT("EnableAutoReload_Description", "Automatically reload your weapon when the magazine is empty and you are not firing."));
       ```
   *   **For "Motion Blur Quality" (discrete number):**

       ```cpp
       // In LyraGameSettingRegistry_Video.cpp
       UGameSettingValueDiscreteDynamic_Number* MotionBlurSetting = NewObject<UGameSettingValueDiscreteDynamic_Number>();
       MotionBlurSetting->SetDevName(TEXT("MotionBlurQuality"));
       MotionBlurSetting->SetDisplayName(LOCTEXT("MotionBlurQuality_Name", "Motion Blur"));
       MotionBlurSetting->SetDescriptionRichText(LOCTEXT("MotionBlurQuality_Description", "Controls the quality of motion blur. Higher settings are more visually accurate but can impact performance."));
       ```
4. **Bind to Backend Getters/Setters:**
   * Use `SetDynamicGetter()` and `SetDynamicSetter()` with the `GET_..._FUNCTION_PATH` macros, and set the UI's default value.
   *   **For "Auto-Reload Weapon" (`ULyraSettingsShared`):**

       ```cpp
       AutoReloadSetting->SetDynamicGetter(GET_SHARED_SETTINGS_FUNCTION_PATH(GetEnableAutoReload));
       AutoReloadSetting->SetDynamicSetter(GET_SHARED_SETTINGS_FUNCTION_PATH(SetEnableAutoReload));
       AutoReloadSetting->SetDefaultValue(GetDefault<ULyraSettingsShared>()->GetEnableAutoReload());
       ```
   *   **For "Motion Blur Quality" (`ULyraSettingsLocal`):**

       ```cpp
       MotionBlurSetting->SetDynamicGetter(GET_LOCAL_SETTINGS_FUNCTION_PATH(GetMotionBlurQuality));
       MotionBlurSetting->SetDynamicSetter(GET_LOCAL_SETTINGS_FUNCTION_PATH(SetMotionBlurQuality));
       MotionBlurSetting->SetDefaultValue(GetDefault<ULyraSettingsLocal>()->GetMotionBlurQuality());
       ```
5. **Add Options (If Applicable):**
   * Define the choices available in the UI for discrete settings.
   *   **For "Motion Blur Quality":**

       ```cpp
       MotionBlurSetting->AddOption(0, LOCTEXT("MotionBlurQuality_Off", "Off"));
       MotionBlurSetting->AddOption(1, LOCTEXT("MotionBlurQuality_Low", "Low"));
       MotionBlurSetting->AddOption(2, LOCTEXT("MotionBlurQuality_Medium", "Medium"));
       MotionBlurSetting->AddOption(3, LOCTEXT("MotionBlurQuality_High", "High"));
       ```
   * ("Auto-Reload Weapon" is a boolean, so `UGameSettingValueDiscreteDynamic_Bool` handles its "On"/"Off" options automatically).
6.  **Add to Target Collection:**

    * Add your new `UGameSettingValue*` object to the `UGameSettingCollection` (or `UGameSettingCollectionPage`) you identified or created in substep 2.
    *   **For "Auto-Reload Weapon":**

        ```cpp
        // Assuming 'GameplayPreferencesCollection' is the target UGameSettingCollection*
        GameplayPreferencesCollection->AddSetting(AutoReloadSetting);
        // Or if we created 'AutoAssistCollection':
        // AutoAssistCollection->AddSetting(AutoReloadSetting);
        ```
    *   **For "Motion Blur Quality":**

        ```cpp
        // Assuming 'AdvancedGraphicsCollection' is the target UGameSettingCollection*
        AdvancedGraphicsCollection->AddSetting(MotionBlurSetting);
        // Or if we created 'PostProcessingPage' and added a collection to it:
        // PostProcessingPageChildCollection->AddSetting(MotionBlurSetting);
        ```

    This `AddSetting` call establishes the parent-child relationship that dictates the UI hierarchy.
7. **Add Edit Conditions/Dependencies (Optional):**
   * If your setting should only be active or visible under certain conditions, use `AddEditCondition()`.

### **Step 4: (Optional) Create Custom UI Setting Widgets**

If your new setting requires a more complex UI than a simple toggle, slider, or dropdown (e.g., a color picker, a list with multi-select, a dedicated editor panel like `ULyraSafeZoneEditor`), you will need to:

1. Create a new `UGameSettingValue` derived class (if the interaction logic is complex).
2. Create a new UMG widget (often deriving from `UGameSettingListEntry` or `UCommonActivatableWidget`) to provide the custom UI.
3. In your UMG widget's C++ or Blueprint, implement the logic to display the setting's current value and to update the `UGameSettingValue` object when the user interacts with it.
4. The `ULyraGameSettingRegistry` would then instantiate your custom `UGameSettingValue` type. The GameSettings system has mechanisms for associating specific UMG widget classes with `UGameSetting` types.

### **Step 5: Testing and Verification**

1. Compile your code.
2. Run the game and navigate to the settings screen.
3. Verify your new setting appears in the correct section with the correct display name, description, and options.
4. Test changing the setting's value.
5. Click "Apply" and verify the setting is persisted (check save files or `.ini` files if necessary).
6. Restart the game and verify the setting is correctly loaded and applied.
7. Test the actual in-game effect of your setting.

***

### **Example Scenario: Adding a "Field of View (FOV)" Setting**

Let's outline how you might add a player-configurable FOV setting:

1. **Choose Backend:** FOV is a player preference, so `ULyraSettingsShared`.
2. **Implement Backend (`ULyraSettingsShared`):**
   * Add `UPROPERTY() float FieldOfView = 90.0f;`
   * Add `GetFieldOfView()` and `SetFieldOfView(float NewFOV)` (using `ChangeValueAndDirty`).
   * In `ApplySettings()`, get the player's camera manager and call `SetFOV(FieldOfView)`.
3. **Register in `ULyraGameSettingRegistry_Video.cpp`:**
   * Under a "Display" or "Graphics" `UGameSettingCollection`.
   * Create `UGameSettingValueScalarDynamic* FOVSetting = NewObject<UGameSettingValueScalarDynamic>();`.
   * Set DevName, DisplayName ("Field of View"), Description.
   * `FOVSetting->SetDynamicGetter(GET_SHARED_SETTINGS_FUNCTION_PATH(GetFieldOfView));`
   * `FOVSetting->SetDynamicSetter(GET_SHARED_SETTINGS_FUNCTION_PATH(SetFieldOfView));`
   * `FOVSetting->SetDefaultValue(GetDefault<ULyraSettingsShared>()->GetFieldOfView());`
   * `FOVSetting->SetDisplayFormat(...)` to show degrees (e.g., map 0-1 to 70-120 degrees).
   * `FOVSetting->SetSourceRangeAndStep(TRange<double>(70.0, 120.0), 1.0);` (if you want the slider to directly represent these values instead of a normalized 0-1 that you map).
   * Add `FOVSetting` to the collection.
4. **Testing:** Verify the slider appears, changes the FOV in real-time (if `OnSettingChanged` in `ULyraSettingsShared` triggers an apply, or on "Apply"), saves, and loads correctly.

***

### **Modifying Existing Settings**

Modifying existing settings follows a similar pattern but focuses on changing parts of the existing implementation:

* **Changing Default Values:**
  * Modify the default value in the property declaration in `ULyraSettingsShared.h` or `ULyraSettingsLocal.h`.
  * Update the default value in `ULyraSettingsLocal::SetToDefaults()` if it's a local setting.
  * Update the `SetDefaultValue()` call in the `ULyraGameSettingRegistry` for the corresponding UI setting object.
* **Altering Application Logic:**
  * Modify the code within `ULyraSettingsShared::ApplySettings()`, `ULyraSettingsLocal::ApplyNonResolutionSettings()`, or the relevant setter function that applies the setting to the game.
* **Adjusting UI Presentation or Options:**
  * In the `ULyraGameSettingRegistry_*.cpp` files:
    * Change `DisplayName` or `DescriptionRichText`.
    * Add/remove/modify options for discrete settings (`AddOption`, `AddEnumOption`).
    * Change the `DisplayFormat` or `SourceRangeAndStep` for scalar settings.
    * Modify or add `EditConditions`.

***

By following these workflows, you can effectively customize Lyra's settings system to perfectly match the requirements of your game, adding new layers of player control and hardware adaptability. Remember to always test thoroughly after making changes.
