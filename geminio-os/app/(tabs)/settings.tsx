import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, ScreenHeader } from "@/components/super-app";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";

export default function SettingsScreen() {
  const colors = useColors();
  const { logout, authMethod } = useAuth();
  const confirmLogout = () => Alert.alert("Log out of Geminio OS?", "You can sign in again at any time.", [
    { text: "Cancel", style: "cancel" },
    { text: "Log out", style: "destructive", onPress: () => void logout() },
  ]);
  return (
    <ScreenContainer className="p-0" edges={["top","left","right","bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="PREFERENCES & ACCOUNT" title="Settings" subtitle="Manage your profile, connected sign-in, account information, and support." />
        <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/profile")} style={({pressed})=>[styles.profile,{backgroundColor:colors.surface,borderColor:colors.border},pressed&&styles.pressed]}>
          <View style={[styles.avatar,{backgroundColor:colors.primary}]}><Text style={styles.avatarText}>G</Text></View>
          <View style={{flex:1,gap:3}}><Text style={[styles.profileTitle,{color:colors.foreground}]}>Your profile</Text><Text style={[styles.description,{color:colors.muted}]}>Personal details and workspace preferences</Text></View>
          <AppIcon name="chevron-right" color={colors.muted} size={20}/>
        </Pressable>
        <Text style={[styles.groupTitle,{color:colors.muted}]}>Account & sign-in</Text>
        <View style={[styles.group,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <SettingRow icon="account-circle" title="Account details" subtitle={authMethod === "none" ? "Sign in to view account details" : "Signed in using " + authMethod} onPress={() => router.push("/(tabs)/profile")}/>
          <SettingRow icon="google" title="Google sign-in" subtitle="Provider sign-in is available when server credentials are configured" onPress={() => router.push("/auth-screen")}/>
        </View>
        <Text style={[styles.groupTitle,{color:colors.muted}]}>Information & support</Text>
        <View style={[styles.group,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <SettingRow icon="person" title="Meet the Founder" subtitle="The vision behind Geminio OS" onPress={() => router.push("/founder")}/>
          <SettingRow icon="description" title="About & Privacy Policy" subtitle="Product information and privacy overview" onPress={() => router.push("/about")}/>
          <SettingRow icon="mail-outline" title="Contact Us & Feedback" subtitle="Get help or share product feedback" onPress={() => router.push("/about")}/>
        </View>
        <Pressable accessibilityRole="button" onPress={confirmLogout} style={({pressed})=>[styles.logout,{backgroundColor:colors.surface,borderColor:colors.error},pressed&&styles.pressed]}>
          <AppIcon name="logout" color={colors.error} size={19}/><Text style={[styles.logoutText,{color:colors.error}]}>Log out</Text>
        </Pressable>
        <Text style={[styles.footer,{color:colors.muted}]}>Geminio OS · v1.0.0</Text>
      </ScrollView>
    </ScreenContainer>
  );
}
function SettingRow({icon,title,subtitle,onPress}:{icon:"account-circle"|"google"|"person"|"description"|"mail-outline";title:string;subtitle:string;onPress:()=>void}){
 const colors=useColors();
 return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({pressed})=>[styles.row,pressed&&styles.pressed]}>
  <View style={[styles.icon,{backgroundColor:colors.primary+"18"}]}><AppIcon name={icon} color={colors.primary} size={19}/></View>
  <View style={{flex:1,gap:3}}><Text style={[styles.rowTitle,{color:colors.foreground}]}>{title}</Text><Text style={[styles.description,{color:colors.muted}]}>{subtitle}</Text></View>
  <AppIcon name="chevron-right" color={colors.muted} size={19}/>
 </Pressable>;
}
const styles=StyleSheet.create({
 content:{paddingHorizontal:20,paddingTop:17,paddingBottom:42,gap:12},profile:{minHeight:82,borderWidth:1,borderRadius:19,padding:13,flexDirection:"row",alignItems:"center",gap:12,marginTop:7},
 avatar:{width:48,height:48,borderRadius:16,alignItems:"center",justifyContent:"center"},avatarText:{color:"#FFFFFF",fontSize:22,fontWeight:"900"},
 profileTitle:{fontSize:15,fontWeight:"900"},description:{fontSize:12,lineHeight:17},groupTitle:{fontSize:11,fontWeight:"900",letterSpacing:0.8,textTransform:"uppercase",marginTop:13},
 group:{borderWidth:1,borderRadius:19,overflow:"hidden"},row:{minHeight:75,paddingHorizontal:13,flexDirection:"row",alignItems:"center",gap:11,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#64748B33"},
 icon:{width:37,height:37,borderRadius:12,alignItems:"center",justifyContent:"center"},rowTitle:{fontSize:14,fontWeight:"800"},
 logout:{minHeight:52,borderWidth:1,borderRadius:16,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9,marginTop:18},
 logoutText:{fontSize:14,fontWeight:"900"},footer:{fontSize:11,textAlign:"center",marginTop:2},pressed:{opacity:0.72}
});
