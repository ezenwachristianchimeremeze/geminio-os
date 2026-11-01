import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, IconButton, ScreenHeader } from "@/components/super-app";
import { useColors } from "@/hooks/use-colors";
import * as Linking from "expo-linking";
import { Alert } from "react-native";

export default function FounderScreen() {
  const colors = useColors();
  const contact = async () => {
    const url = "mailto:support@geminio.os?subject=Contact%20Geminio%20OS%20Founder";
    try { await Linking.openURL(url); }
    catch { Alert.alert("Email unavailable", "Your device could not open an email application. Contact support@geminio.os."); }
  };
  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.top}><IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} /></View>
        <ScreenHeader eyebrow="THE PERSON BEHIND THE PLATFORM" title="Meet the Founder" subtitle="A long-term vision for a more capable, connected way to work with technology." />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>EC</Text></View>
          <Text style={[styles.name, { color: colors.foreground }]}>Ezenwa Christian</Text>
          <Text style={[styles.role, { color: colors.primary }]}>Founder & CEO, Geminio OS</Text>
          <Text style={[styles.bio, { color: colors.muted }]}>Building an AI-first workspace designed to bring intelligent assistance, creation tools, automation, and productive workflows into one connected environment.</Text>
        </View>
        <Text style={[styles.section, { color: colors.foreground }]}>The Vision</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Geminio OS is envisioned as an AI operating layer: a unified place where people can think, learn, build software, organize projects, automate tasks, and work across connected tools. The goal is to make advanced technology more accessible while keeping people in control of important actions and decisions.</Text>
        <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="auto-awesome" color={colors.primary} size={22} />
          <Text style={[styles.noteText, { color: colors.foreground }]}>Built around a simple principle: technology should help people turn ideas into meaningful work.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void contact()} style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
          <AppIcon name="mail-outline" color={colors.primaryForeground} size={19} />
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Contact Founder</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
 content:{paddingHorizontal:20,paddingTop:14,paddingBottom:40,gap:15},top:{marginBottom:2},
 card:{borderWidth:1,borderRadius:24,padding:22,alignItems:"center",gap:9},
 avatar:{width:104,height:104,borderRadius:52,alignItems:"center",justifyContent:"center",marginBottom:5},
 avatarText:{color:"#FFFFFF",fontSize:30,fontWeight:"900"},
 name:{fontSize:23,fontWeight:"900",textAlign:"center"},role:{fontSize:13,fontWeight:"800",textAlign:"center"},
 bio:{fontSize:14,lineHeight:22,textAlign:"center",marginTop:4},
 section:{fontSize:18,fontWeight:"900",marginTop:5},body:{fontSize:14,lineHeight:23},
 note:{borderWidth:1,borderRadius:17,padding:16,flexDirection:"row",gap:12,alignItems:"center"},
 noteText:{fontSize:13,lineHeight:20,flex:1},button:{minHeight:54,borderRadius:16,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9,marginTop:5},
 buttonText:{fontSize:15,fontWeight:"800"},pressed:{opacity:0.75}
});
