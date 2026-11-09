import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, IconButton, ScreenHeader } from "@/components/super-app";
import { useColors } from "@/hooks/use-colors";

const SUPPORT_EMAIL = "support@geminio.os";
export default function AboutScreen() {
  const colors = useColors();
  const openMail = async (subject: string) => {
    try { await Linking.openURL("mailto:" + SUPPORT_EMAIL + "?subject=" + encodeURIComponent(subject)); }
    catch { Alert.alert("Email unavailable", "Please contact " + SUPPORT_EMAIL + " from your email application."); }
  };
  return (
    <ScreenContainer className="p-0" edges={["top","left","right","bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.top}><IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} /></View>
        <ScreenHeader eyebrow="GEMINIO OS" title="About & Privacy" subtitle="Product information, privacy principles, and ways to reach the team." />
        <View style={[styles.versionCard,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <View style={[styles.mark,{backgroundColor:colors.primary}]}><Text style={styles.markText}>G</Text></View>
          <View style={{flex:1,gap:3}}><Text style={[styles.product,{color:colors.foreground}]}>Geminio OS</Text><Text style={[styles.muted,{color:colors.muted}]}>AI-first connected workspace</Text></View>
          <Text style={[styles.version,{color:colors.primary}]}>v1.0.0</Text>
        </View>
        <Text style={[styles.section,{color:colors.foreground}]}>Privacy Policy (overview)</Text>
        <Text style={[styles.body,{color:colors.muted}]}>Geminio OS is designed to handle account and workspace information responsibly. Authentication credentials and provider secrets must be processed on trusted server infrastructure, not exposed in the client application.</Text>
        <Text style={[styles.body,{color:colors.muted}]}>Workspace information should be accessible only to the authenticated account and authorized services. Connected providers should receive only the permissions needed for the feature being used. Sensitive actions should be clearly presented for user review before execution.</Text>
        <Text style={[styles.body,{color:colors.muted}]}>You should be able to review available privacy controls, manage local memory, and request support about account data. This in-app overview is informational and is not a substitute for a formally reviewed legal privacy notice.</Text>
        <View style={[styles.contactCard,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Text style={[styles.contactTitle,{color:colors.foreground}]}>Need help or want to share feedback?</Text>
          <Text style={[styles.body,{color:colors.muted}]}>Email the Geminio OS team at {SUPPORT_EMAIL}.</Text>
          <Pressable accessibilityRole="button" onPress={() => void openMail("Geminio OS Support")} style={({pressed})=>[styles.action,{backgroundColor:colors.primary},pressed&&styles.pressed]}>
            <AppIcon name="mail-outline" color={colors.primaryForeground} size={18}/><Text style={[styles.actionText,{color:colors.primaryForeground}]}>Contact Support</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void openMail("Geminio OS Feedback")} style={({pressed})=>[styles.secondary,{borderColor:colors.border},pressed&&styles.pressed]}>
            <AppIcon name="feedback" color={colors.primary} size={18}/><Text style={[styles.secondaryText,{color:colors.foreground}]}>Send Feedback</Text>
          </Pressable>
        </View>
        <Text style={[styles.footer,{color:colors.muted}]}>© 2026 Geminio OS. All rights reserved.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}
const styles=StyleSheet.create({
 content:{paddingHorizontal:20,paddingTop:14,paddingBottom:42,gap:14},top:{marginBottom:2},
 versionCard:{borderWidth:1,borderRadius:20,padding:15,flexDirection:"row",alignItems:"center",gap:12},
 mark:{width:48,height:48,borderRadius:15,alignItems:"center",justifyContent:"center"},markText:{color:"#FFFFFF",fontSize:25,fontWeight:"900"},
 product:{fontSize:16,fontWeight:"900"},muted:{fontSize:12},version:{fontSize:12,fontWeight:"900"},
 section:{fontSize:17,fontWeight:"900",marginTop:8},body:{fontSize:13,lineHeight:21},
 contactCard:{borderWidth:1,borderRadius:20,padding:16,gap:12,marginTop:5},contactTitle:{fontSize:16,fontWeight:"900"},
 action:{minHeight:48,borderRadius:14,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},actionText:{fontSize:14,fontWeight:"800"},
 secondary:{minHeight:48,borderRadius:14,borderWidth:1,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},secondaryText:{fontSize:14,fontWeight:"800"},
 footer:{fontSize:11,textAlign:"center",marginTop:8},pressed:{opacity:0.75}
});
