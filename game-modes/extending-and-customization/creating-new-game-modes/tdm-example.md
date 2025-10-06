# TDM Example

### **Creating the game feature plugin**





***

#### **B. Setting Up a Playable Character**

Lyra uses **Experience Definitions** to define what happens at runtime. Let’s create one for our custom game mode.

1️⃣ **Go to** `Content/YourGameFeaturePlugin/Experiences`\
2️⃣ **Create a New Data Asset** → Type: `LyraExperienceDefinition`\
3️⃣ Name it **DA_MyExperience**\
4️⃣ Open it and set:

* **GameMode** → `BP_MyGameMode`
* **PawnData** → `BP_LyraCharacter`
* **InputConfig** → `DefaultInputConfig`

💡 **Now your game will load your custom experience when played.**

***

#### **C. Spawning & Weapon Setup**

1️⃣ **Go to** `BP_LyraCharacter`\
2️⃣ **Check the Components tab** → You should see `Equipment Manager Component`\
3️⃣ **Modify Default Weapons**:

* Open **BP_LyraCharacter’s EquipmentManager**
* Set **Default Weapons** to `BP_ShooterWeapon`

🔫 **Now your character spawns with a working weapon!**

***

### **Playtesting Your Game Mode**

Let’s test the game in **Team Deathmatch mode**.

#### **🔄 Steps to Playtest**

1️⃣ Open the **Main Editor Window**\
2️⃣ Click `Window → Lyra Menu`\
3️⃣ In the `Experience Override` dropdown, select **DA_MyExperience**\
4️⃣ Click **Play**!

🎮 You should now be running around, **shooting with a working weapon**, and playing inside a functional game mode.

***

### **Customizing Your Game Mode**

Now that you have a basic shooter working, let’s tweak some mechanics:

#### **A. Changing Spawn Logic**

1️⃣ **Go to** `BP_MyGameMode`\
2️⃣ Find the **Spawn System** component\
3️⃣ Modify **Spawn Rules**:

* Adjust spawn weight based on **enemy distance, LOS, and teammate positions**
* Enable **Influence-Based Spawning** for better enemy placement

***

#### **B. Adding a Kill Feed & Streak Tracker**

1️⃣ **Go to** `BP_MyGameMode`\
2️⃣ Add **BP_AccoladeSystemComponent** to track kill streaks\
3️⃣ Customize messages displayed in the **Kill Feed Widget**

***

#### **C. Adjusting Weapons & Recoil**

1️⃣ Open **BP_ShooterWeapon**\
2️⃣ Go to **Recoil Pattern Editor**\
3️⃣ Modify the recoil sequence for a custom feel\
4️⃣ Test changes in **Live Play Mode**
