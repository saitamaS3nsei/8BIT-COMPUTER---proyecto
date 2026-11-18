import com.cburch.logisim.comp.*;
import com.cburch.logisim.data.*;

/** Reads component metadata directly from the requested Logisim JAR. No simulation. */
public class Inspect {
  @SuppressWarnings({"rawtypes","unchecked"})
  public static void main(String[] args) throws Exception {
    for (String spec : args) {
      String[] parts=spec.split(";");
      Class<?> cls=Class.forName(parts[0]);
      ComponentFactory f;
      try {f=(ComponentFactory)cls.getConstructor().newInstance();}
      catch (NoSuchMethodException e) {java.lang.reflect.Field field;try{field=cls.getDeclaredField("instance");}catch(NoSuchFieldException x){field=cls.getDeclaredField("FACTORY");}field.setAccessible(true);f=(ComponentFactory)field.get(null);}
      AttributeSet a=f.createAttributeSet();
      for(int i=1;i<parts.length;i++){String[] kv=parts[i].split("=",2);Attribute attr=a.getAttribute(kv[0]);if(attr==null)throw new Exception("No attribute "+kv[0]);a.setValue(attr,attr.parse(kv[1]));}
      System.out.println("COMP "+f.getName()+" "+spec);
      for(Attribute attr:a.getAttributes())System.out.println("ATTR "+attr.getName()+"="+attr.toStandardString(a.getValue(attr)));
      Component c=f.createComponent(Location.create(0,0,true),a);
      System.out.println("BOUNDS "+c.getBounds());
      int i=0;for(EndData p:c.getEnds())System.out.println("PORT "+(i++)+" "+p.getLocation().getX()+" "+p.getLocation().getY()+" "+p.getWidth().getWidth()+" "+p.getType());
    }
  }
}
